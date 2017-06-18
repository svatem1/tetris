// visible grid is 10x20, grid is 10x22, 2 hidden lines for initial piece position

// one canvas for grid one canvas for falling piece
const canvas = new Map(["grid", "piece"].map((id, i) => {
    const cnv = document.createElement("canvas");
    [cnv.width, cnv.height, cnv.zIndex] = [10, 20, i];
    document.body.appendChild(cnv);
    return [id, {
        canvas: cnv,
        ctx: cnv.getContext("2d")
    }]
}));

const rgba = (r, g, b, a) => (r | g << 8 | b << 16 | a << 24) >>> 0; // >>> 0 for int/uint conversion

const VOID = rgba(35, 35, 35, 255); // background color

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
];

const grid = (new Uint32Array(10 * 22)).fill(VOID);


const xy2grid = ([x, y]) => (21 - y) * 10 + x;

const inside = ([x, y]) => x >= 0 && x <= 9 && y >= 0 && y <= 21;

const vecAdd = (a, b) => a.map((el, i) => el + b[i]);

function drawGrid(where, grid) {
    canvas.get(where).ctx.putImageData(new ImageData(new Uint8ClampedArray(grid.buffer, 10 * 2 * 4, 10 * 20 * 4), 10, 20), 0, 0);
}

function canPlace({ piece, rot }, pos) {
    return piece.data[rot].map(i => vecAdd(pos, i)).every(j => inside(j) && grid[xy2grid(j)] === VOID);
}

function place({ piece, rot }, grid, pos) {
    return (piece.data[rot].forEach(coord => grid[xy2grid(vecAdd(pos, coord))] = piece.color), grid);
}

function drawPiece(piece, pos) {
    drawGrid("piece", place(piece, new Uint32Array(new ImageData(10, 22).data.buffer), pos));
}

function iterLines(grid, fn, init) {
    return [...Array(22).keys()].map(y => xy2grid([0, 21 - y])).reduce((res, offset) =>
        grid.subarray(offset, offset + 10).every(color => color !== VOID) ? fn(res, offset) : res, init);
}

function shrinkLines(grid) {
    return iterLines(grid, (r, offset) => grid.copyWithin(10, 0, offset).subarray(0, 10).fill(VOID), grid);
}

function countLines(grid) {
    return iterLines(grid, (res,) => res + 1, 0);
}

function precalcPieces() {
    PIECES.forEach(piece => [...Array(piece.rots - 1).keys()].forEach(i =>
        piece.data.push(piece.data[i].map(([x, y]) => [y, -x]))));
}

function getPiece(piece) {
    return {
        piece: piece,
        rot: 0
    }
}

function rotPiece({ piece, rot }) {
    return {
        piece: piece,
        // rot: (rot + piece.rots - 1) % piece.rots // CCW
        rot: (rot + 1) % piece.rots // CW
    }
}

function resize(ar) {
    const [x, y] = [window.innerWidth, window.innerHeight];
    const ratio = y / x;
    const width = ratio > ar ? x : Math.floor(y / ar);
    const height = ratio > ar ? Math.floor(ar * x) : y;

    [...canvas.values()].forEach(({ canvas }) => {
        [["width", width], ["height", height]].forEach(([prop, size]) => {
            canvas.style[prop] = size.toString() + "px";
        });
    });
}

function newGame() {
    grid.fill(VOID);
    drawGrid("grid", grid);
    gameplay(0);
}

function gameplay(shrinkedLines) {
    const dirs = new Map([[37, [-1, 0]], [39, [1, 0]], [40, [0, -1]], [38, [0, 0]]]);
    let [piece, pos] = [getPiece(PIECES[Math.floor(Math.random() * PIECES.length)]), [4, 20]];

    const controls = event => {
        if (dirs.has(event.keyCode)) {
            const [newPiece, newPos] = [event.keyCode === 38 ? rotPiece(piece) : piece, vecAdd(pos, dirs.get(event.keyCode))];
            if (canPlace(newPiece, newPos)) {
                canvas.get("piece").ctx.clearRect(0, 0, 10, 22);
                drawPiece(newPiece, newPos);
                [piece, pos] = [newPiece, newPos];
            }
        }
        event.preventDefault();
    };

    const down = () => {
        const newPos = vecAdd(pos, [0, -1]);
        canvas.get("piece").ctx.clearRect(0, 0, 10, 22);
        if (canPlace(piece, newPos)) {
            drawPiece(piece, newPos);
            pos = newPos;
            setTimeout(down, shrinkedLines > 100 ? 80 : 80000 / (9 * shrinkedLines + 100));
        } else {
            const lines = countLines(place(piece, grid, pos));
            drawGrid("grid", shrinkLines(grid));
            document.body.onkeydown = undefined;
            setTimeout(() => gameplay(shrinkedLines + lines), 0); // to avoid recursion
        }
    };

    if (!canPlace(piece, pos))
        newGame();
    else {
        setTimeout(down, 0);
        document.body.onkeydown = controls;
    }
}

window.onload = function() {
    precalcPieces();
    window.onresize = () => resize(2);
    resize(2);
    newGame();
};
