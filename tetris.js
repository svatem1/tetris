const rgba = (r, g, b, a) => (r | g << 8 | b << 16 | a << 24) >>> 0; // >>> 0 for int/uint conversion


const VOID = rgba(35, 35, 35, 255); // background color

// visible grid is 10x20, grid is 10x22, 2 hidden lines for initial piece position
const GRID = (new Uint32Array(10 * 22)).fill(VOID); // we need the initialization for the 1st run of the game

// DOM is already constructed at this point in time, because of html structure
const CANVAS = new Map(["grid", "piece"].map(id => [id, document.getElementById(id).getContext("2d")]));

const PIECES = [
// http://tetris.wikia.com/wiki/Tetromino
// pcs will be initially positioned in top hidden 10x2 as pictured ^
// pivot in 10x2 is [4, 0] = [4, 20], zero based, growing up right
// deltas in pcs.data are from ^
    { data: [[[-1, 0], [0, 0], [1, 0], [2, 0]]], rots: 2, color: rgba(255, 0, 77, 255) }, // I
    { data: [[[0, 0], [0, 1], [1, 1], [1, 0]]], rots: 1, color: rgba(255, 163, 0, 255) }, // O
    { data: [[[-1, 0], [0, 0], [0, 1], [1, 0]]], rots: 4, color: rgba(255, 236, 39, 255) }, // T
    { data: [[[-1, 0], [0, 0], [0, 1], [1, 1]]], rots: 2, color: rgba(0, 228, 54, 255) }, // S
    { data: [[[-1, 1], [0, 1], [0, 0], [1, 0]]], rots: 2, color: rgba(41, 173, 255, 255) }, // Z
    { data: [[[-1, 1], [-1, 0], [0, 0], [1, 0]]], rots: 4, color: rgba(255, 119, 168, 255) }, // J
    { data: [[[-1, 0], [0, 0], [1, 0], [1, 1]]], rots: 4, color: rgba(255, 204, 170, 255) }  // L
    // precalculates look-up table with rotated pieces, generates 1 more rotation than needed, but rotPiece takes care of it via %
].map(p => ({ ...p, data: [...Array(p.rots - 1).keys()].reduce((acc, i) => [...acc, acc[i].map(([x, y]) => [y, -x])], p.data) }));


const xy2grid = ([x, y]) => (21 - y) * 10 + x;

const inside = ([x, y]) => x >= 0 && x <= 9 && y >= 0 && y <= 21;

const vecAdd = (a, b) => a.map((el, i) => el + b[i]);

const drawGrid = (where, grid) => CANVAS.get(where).putImageData(new ImageData(new Uint8ClampedArray(grid.buffer, 10 * 2 * 4, 10 * 20 * 4), 10, 20), 0, 0);
drawGrid("grid", GRID); // we need this for 1st run of the game

const canPlace = ({ piece, rot }, pos) => piece.data[rot].map(i => vecAdd(pos, i)).every(j => inside(j) && GRID[xy2grid(j)] === VOID);

const place = ({ piece, rot }, grid, pos) => (piece.data[rot].forEach(coord => grid[xy2grid(vecAdd(pos, coord))] = piece.color), grid);

const drawPiece = (piece, pos) => drawGrid("piece", place(piece, new Uint32Array(new ImageData(10, 22).data.buffer), pos));

const iterLines = (grid, fn, init) => [...Array(22).keys()].map(y => xy2grid([0, 21 - y])).reduce((res, offset) => grid.subarray(offset, offset + 10).every(color => color !== VOID) ? fn(res, offset) : res, init);

const shrinkLines = (grid) => iterLines(grid, (_, offset) => grid.copyWithin(10, 0, offset).subarray(0, 10).fill(VOID), grid);

const countLines = grid => iterLines(grid, (res,) => res + 1, 0);

const getPiece = piece => ({ piece: piece, rot: 0 });

// const rotPieceCCW = ({ piece, rot }) => ({ piece: piece, rot: (rot + piece.rots - 1) % piece.rots });
const rotPieceCW = ({ piece, rot }) => ({ piece: piece, rot: (rot + 1) % piece.rots });


(function gameplay(shrinkedLines) {
    let [piece, pos] = [getPiece(PIECES[Math.floor(Math.random() * PIECES.length)]), [4, 20]];

    const controls = event => {
        const dirs = new Map([[37, [-1, 0]], [39, [1, 0]], [40, [0, -1]], [38, [0, 0]]]);
        if (dirs.has(event.keyCode)) {
            const newPiece = event.keyCode === 38 ? rotPieceCW(piece) : piece;
            const kicks = (newPiece.rot & 1) ? [[0, 0], [0, 1], [0, 2]] : [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0]];
            kicks.some(coord => {
                const newPos = vecAdd(coord, vecAdd(pos, dirs.get(event.keyCode)));
                if (canPlace(newPiece, newPos)) {
                    CANVAS.get("piece").clearRect(0, 0, 10, 22);
                    drawPiece(newPiece, newPos);
                    [piece, pos] = [newPiece, newPos];
                    return true;
                }
                return event.keyCode !== 38;
            });
        }
        event.preventDefault();
    };

    const down = () => {
        const newPos = vecAdd(pos, [0, -1]);
        CANVAS.get("piece").clearRect(0, 0, 10, 22);
        if (canPlace(piece, newPos)) {
            drawPiece(piece, newPos);
            pos = newPos;
            setTimeout(down, shrinkedLines > 100 ? 80 : 80000 / (9 * shrinkedLines + 100));
        } else {
            const lines = countLines(place(piece, GRID, pos));
            drawGrid("grid", shrinkLines(GRID));
            document.body.onkeydown = undefined;
            setTimeout(() => gameplay(shrinkedLines + lines), 0); // to avoid recursion
        }
    };

    if (!canPlace(piece, pos)) { // new game, for 1st game, these are already initialized
        GRID.fill(VOID);
        drawGrid("grid", GRID);
        gameplay(0);
    } else {
        setTimeout(down, 0);
        document.body.onkeydown = controls;
    }
})(0);
