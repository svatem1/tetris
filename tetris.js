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

const VOID = rgba(0, 0, 0, 255); // background color

const PIECES = [
// http://tetris.wikia.com/wiki/Tetromino
// pcs will be initially positioned in top hidden 10x2 as pictured ^
// pivot in 10x2 is [4, 0] = [4, 20], zero based, growing up right
// deltas in pcs.data are from ^
    { data: [[[-1, 0], [0, 0], [1, 0], [2, 0]]], rots: 2, color: rgba(128, 255, 255, 255) }, // I
    { data: [[[0, 0], [0, 1], [1, 1], [1, 0]]], rots: 1, color: rgba(255, 255, 0, 255) }, // O
    { data: [[[-1, 0], [0, 0], [0, 1], [1, 0]]], rots: 4, color: rgba(255, 0, 255, 255) }, // T
    { data: [[[-1, 0], [0, 0], [0, 1], [1, 1]]], rots: 2, color: rgba(0, 255, 0, 255) }, // S
    { data: [[[-1, 1], [0, 1], [0, 0], [1, 0]]], rots: 2, color: rgba(255, 0, 0, 255) }, // Z
    { data: [[[-1, 1], [-1, 0], [0, 0], [1, 0]]], rots: 4, color: rgba(0, 0, 255, 255) }, // J
    { data: [[[-1, 0], [0, 0], [1, 0], [1, 1]]], rots: 4, color: rgba(255, 255, 128, 255) }  // L
];

const grid = (new Uint32Array(10 * 22)).fill(VOID);

let speed = 1; // lines/s, ranging from 1 to 10

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

function shrinkGrid(grid) {
    for (let y = 21, offset = xy2grid([0, y]); y >= 0; y--, offset = xy2grid([0, y]))
        if (grid.subarray(offset, offset + 10).every(color => color !== VOID))
            grid.copyWithin(10, 0, offset).subarray(0, 10).fill(VOID);
    return grid;
}

function precalcPieces() {
    PIECES.forEach(piece => {
        let out = piece.data[0];
        [...Array(piece.rots - 1).keys()].forEach(() => {
            out = out.map(([x, y]) => [y, -x]);
            piece.data.push(out);
        });
    })
}

function getPiece(piece) {
    return {
        piece: piece,
        rot: 0
    }
}

function rotPiece({ piece, rot }, i) {
    return {
        piece: piece,
        rot: (rot + i) % piece.rots
    }
}

function resize() {
    const [x, y] = [window.innerWidth, window.innerHeight];
    const ratio = y / x;
    const width = ratio > 2 ? x : Math.floor(y / 2);
    const height = ratio > 2 ? 2 * x : y;

    [...canvas.values()].forEach(({ canvas }) => {
        [["width", width], ["height", height]].forEach(([prop, size]) => {
            canvas.style[prop] = size.toString() + "px";
        });
    });
}

function newGame() {
    grid.fill(VOID);
    speed = 1;
    drawGrid("grid", grid);
    gameplay();
}

function gameplay() {
    const dirs = new Map([[37, [-1, 0]], [39, [1, 0]], [40, [0, -1]], [38, [0, 0]]]);
    let [piece, pos] = [getPiece(PIECES[Math.floor(Math.random() * PIECES.length)]), [4, 20]];

    document.body.onkeydown = event => {
        if (dirs.has(event.keyCode)) {
            const [newPiece, newPos] = [event.keyCode === 38 ? rotPiece(piece, 1) : piece, vecAdd(pos, dirs.get(event.keyCode))];
            if (canPlace(newPiece, newPos)) {
                canvas.get("piece").ctx.clearRect(0, 0, 10, 22);
                drawPiece(newPiece, newPos);
                [piece, pos] = [newPiece, newPos];
            }
        }
        event.preventDefault();
    };

    const interval = setInterval(() => {
        const newPos = vecAdd(pos, [0, -1]);
        canvas.get("piece").ctx.clearRect(0, 0, 10, 22);
        if (canPlace(piece, newPos)) {
            drawPiece(piece, newPos);
            pos = newPos;
        } else {
            drawGrid("grid", shrinkGrid(place(piece, grid, pos)));
            document.body.onkeydown = undefined;
            clearInterval(interval);
            gameplay();
        }
    }, 300 / speed);

    if (!canPlace(piece, pos))  {
        clearInterval(interval);
        newGame();
    }
}

window.onload = function() {
    precalcPieces();
    window.onresize = resize;
    resize();
    newGame();
};
