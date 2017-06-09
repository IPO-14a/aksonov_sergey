//-------------------------------------------------------------------------
// Базовые методы помощи
//-------------------------------------------------------------------------

/**
* Возвращает элемент по id
*
* @param string $id Уникальный идентификатор элемента
* @return element Возвращает элемент
*/
function get(id) {
    return document.getElementById(id);
}

/**
* Прячет элемент по id
*
* @param string $id Уникальный идентификатор элемента
*/
function hide(id) {
    get(id).style.visibility = 'hidden';
}

/**
* Показывает элемент по id
*
* @param string $id Уникальный идентификатор элемента
*/
function show(id) {
    get(id).style.visibility = null;
}

/**
* Добавляет html код
*
* @param string $id Уникальный идентификатор элемента
* @param string $html Текст, который нужно поместить в этот элемент\
*/
function html(id, html) {
    get(id).innerHTML = html;
}

/**
* Возвращает текущее время
*
* @return Date Возвращает время
*/
function timestamp() {
    return new Date().getTime();
}

/**
* Возвращает случайное число в указанном промежутке
*
* @param int $min Нижняя граница промежутка
* @param int $max Верхняя граница промежутка
*
*@return int Возвращает случайное число
*/
function random(min, max) {
    return (min + (Math.random() * (max - min)));
}

if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(callback, element) {
            window.setTimeout(callback, 1000 / 60);
        }
}

//-------------------------------------------------------------------------
// Игровые константы
//-------------------------------------------------------------------------

var KEY = {
        ESC: 27,
        SPACE: 32,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40
    },
    DIR = {
        UP: 0,
        RIGHT: 1,
        DOWN: 2,
        LEFT: 3,
        MIN: 0,
        MAX: 3
    },
    stats = new Stats(),
    canvas = get('canvas'),
    ctx = canvas.getContext('2d'),
    ucanvas = get('upcoming'),
    uctx = ucanvas.getContext('2d'),
    speed = {
        start: 0.6,
        decrement: 0.005,
        min: 0.1
    }, // how long before piece drops by 1 row (seconds)
    nx = 10, // width of tetris court (in blocks)
    ny = 20, // height of tetris court (in blocks)
    nu = 5; // width/height of upcoming preview (in blocks)

//-------------------------------------------------------------------------
// Игровые переменные (инициализируются во время сброса)
//-------------------------------------------------------------------------

var dx, dy, // pixel size of a single tetris block
    blocks, // 2 dimensional array (nx*ny) representing tetris court - either empty block or occupied by a 'piece'
    actions, // queue of user actions (inputs)
    playing, // true|false - game is in progress
    dt, // time since starting this game
    current, // the current piece
    next, // the next piece
    score, // the current score
    vscore, // the currently displayed score (it catches up to score in small chunks - like a spinning slot machine)
    rows, // number of completed rows in the current game
    step; // how long before current piece drops by 1 row

//-------------------------------------------------------------------------
// tetris pieces
//
// blocks: each element represents a rotation of the piece (0, 90, 180, 270)
//         each element is a 16 bit integer where the 16 bits represent
//         a 4x4 set of blocks, e.g. j.blocks[0] = 0x44C0
//
//             0100 = 0x4 << 3 = 0x4000
//             0100 = 0x4 << 2 = 0x0400
//             1100 = 0xC << 1 = 0x00C0
//             0000 = 0x0 << 0 = 0x0000
//                               ------
//                               0x44C0
//
//-------------------------------------------------------------------------

var i = {
    size: 4,
    blocks: [0x0F00, 0x2222, 0x00F0, 0x4444],
    color: 'cyan'
};
var j = {
    size: 3,
    blocks: [0x44C0, 0x8E00, 0x6440, 0x0E20],
    color: 'blue'
};
var l = {
    size: 3,
    blocks: [0x4460, 0x0E80, 0xC440, 0x2E00],
    color: 'orange'
};
var o = {
    size: 2,
    blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00],
    color: 'yellow'
};
var s = {
    size: 3,
    blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620],
    color: 'green'
};
var t = {
    size: 3,
    blocks: [0x0E40, 0x4C40, 0x4E00, 0x4640],
    color: 'purple'
};
var z = {
    size: 3,
    blocks: [0x0C60, 0x4C80, 0xC600, 0x2640],
    color: 'red'
};

/**
* Выполняет манипуляции с битами и итерацию по каждому занятому блоку (x, y) для данной части
*
* @param var $type Тип детали
* @param var $x Положение детали по x
* @param var $y Положение детали по y
* @param var $dir Направление детали
* @param function $fn Фукнция
*/
function eachblock(type, x, y, dir, fn) {
    var bit, result, row = 0,
        col = 0,
        blocks = type.blocks[dir];
    for (bit = 0x8000; bit > 0; bit = bit >> 1) {
        if (blocks & bit) {
            fn(x + col, y + row);
        }
        if (++col === 4) {
            col = 0;
            ++row;
        }
    }
}

/**
* Проверяет, может ли деталь вписаться в позицию в сетке
*
* @param var $type Тип детали
* @param var $x Положение детали по x
* @param var $y Положение детали по y
* @param var $dir Направление детали
* 
* @return result Возвращает разультат
*/
function occupied(type, x, y, dir) {
    var result = false
    eachblock(type, x, y, dir, function(x, y) {
        if ((x < 0) || (x >= nx) || (y < 0) || (y >= ny) || getBlock(x, y))
            result = true;
    });
    return result;
}

function unoccupied(type, x, y, dir) {
    return !occupied(type, x, y, dir);
}

var pieces = [];

/**
* Начинает с 4 экземпляров каждой части и выбирает случайным образом, пока «сумка не будет пуста»,
*
* @return var Часть
*/
function randomPiece() {
    if (pieces.length == 0)
        pieces = [i, i, i, i, j, j, j, j, l, l, l, l, o, o, o, o, s, s, s, s, t, t, t, t, z, z, z, z];
    var type = pieces.splice(random(0, pieces.length - 1), 1)[0];
    return {
        type: type,
        dir: DIR.UP,
        x: Math.round(random(0, nx - type.size)),
        y: 0
    };
}


/**
* Игровой цикл
*/
function run() {

    showStats(); // initialize FPS counter
    addEvents(); // attach keydown and resize events

    var last = now = timestamp();
	
	/**
    * Отрисовывает кадр.
    */
    function frame() {
        now = timestamp();
        update(Math.min(1, (now - last) / 1000.0)); // using requestAnimationFrame have to be able to handle large delta's caused when it 'hibernates' in a background or non-visible tab
        draw();
        stats.update();
        last = now;
        requestAnimationFrame(frame, canvas);
    }

    resize(); // setup all our sizing information
    reset(); // reset the per-game variables
    frame(); // start the first frame

}

/**
* Показывает статистику
*/
function showStats() {
    stats.domElement.id = 'stats';
    get('menu').appendChild(stats.domElement);
}

/**
* Добавляет события
*/
function addEvents() {
    document.addEventListener('keydown', keydown, false);
    window.addEventListener('resize', resize, false);
}

/**
* Обрабатывает изменение размера окна
* @param event $event Событие изменения размера
*/
function resize(event) {
    canvas.width = canvas.clientWidth; // set canvas logical size equal to its physical size
    canvas.height = canvas.clientHeight; // (ditto)
    ucanvas.width = ucanvas.clientWidth;
    ucanvas.height = ucanvas.clientHeight;
    dx = canvas.width / nx; // pixel size of a single tetris block
    dy = canvas.height / ny; // (ditto)
    invalidate();
    invalidateNext();
}

/**
* Обрабатывает нажатие клавиш
*
* @param event $ev Событие нажатия клавиши
*/
function keydown(ev) {
    var handled = false;
    if (playing) {
        switch (ev.keyCode) {
            case KEY.LEFT:
                actions.push(DIR.LEFT);
                handled = true;
                break;
            case KEY.RIGHT:
                actions.push(DIR.RIGHT);
                handled = true;
                break;
            case KEY.UP:
                actions.push(DIR.UP);
                handled = true;
                break;
            case KEY.DOWN:
                actions.push(DIR.DOWN);
                handled = true;
                break;
            case KEY.ESC:
                lose();
                handled = true;
                break;
        }
    } else if (ev.keyCode == KEY.SPACE) {
        play();
        handled = true;
    }
    if (handled)
        ev.preventDefault(); // prevent arrow keys from scrolling the page (supported in IE9+ and all other browsers)
}

//-------------------------------------------------------------------------
// Игровая логика
//-------------------------------------------------------------------------

/**
* Начинает игру
*/
function play() {
    hide('start');
    reset();
    playing = true;
}

/**
* Заканчивает игру
*/
function lose() {
    show('start');
    setVisualScore();
    playing = false;
}

/**
* Отображает очки
*/
function setVisualScore(n) {
    vscore = n || score;
    invalidateScore();
}

/**
* назначает очки
*/
function setScore(n) {
    score = n;
    setVisualScore(n);
}

/**
* Добавляет очки
*/
function addScore(n) {
    score = score + n;
}

/**
* Очищает очки
*/
function clearScore() {
    setScore(0);
}

/**
* Очищает строки
*/
function clearRows() {
    setRows(0);
}

/**
* Назначает строки
*/
function setRows(n) {
    rows = n;
    step = Math.max(speed.min, speed.start - (speed.decrement * rows));
    invalidateRows();
}

/**
* Добавляет строки
*/
function addRows(n) {
    setRows(rows + n);
}

/**
* Получает блок
*/
function getBlock(x, y) {
    return (blocks && blocks[x] ? blocks[x][y] : null);
}

/**
* Устанавливает блок
*/
function setBlock(x, y, type) {
    blocks[x] = blocks[x] || [];
    blocks[x][y] = type;
    invalidate();
}

/**
* Очищает блоки
*/
function clearBlocks() {
    blocks = [];
    invalidate();
}

/**
* Очищает действия
*/
function clearActions() {
    actions = [];
}

/**
* Назначает текущую часть
*/
function setCurrentPiece(piece) {
    current = piece || randomPiece();
    invalidate();
}

/**
* Назначает следующую часть
*/
function setNextPiece(piece) {
    next = piece || randomPiece();
    invalidateNext();
}

/**
* Производит сброс
*/
function reset() {
    dt = 0;
    clearActions();
    clearBlocks();
    clearRows();
    clearScore();
    setCurrentPiece(next);
    setNextPiece();
}

/**
* Производит обновление
*
*/
function update(idt) {
    if (playing) {
        if (vscore < score)
            setVisualScore(vscore + 1);
        handle(actions.shift());
        dt = dt + idt;
        if (dt > step) {
            dt = dt - step;
            drop();
        }
    }
}

/**
* Обрабатывает событие
*
* @param var $action Действие
*/
function handle(action) {
    switch (action) {
        case DIR.LEFT:
            move(DIR.LEFT);
            break;
        case DIR.RIGHT:
            move(DIR.RIGHT);
            break;
        case DIR.UP:
            rotate();
            break;
        case DIR.DOWN:
            drop();
            break;
    }
}

/**
* Перемещает фигуру
*
* @param var $dir Сторона
* 
* @return bol Возвращает удалось или не удалось выполнить действие
*/
function move(dir) {
    var x = current.x,
        y = current.y;
    switch (dir) {
        case DIR.RIGHT:
            x = x + 1;
            break;
        case DIR.LEFT:
            x = x - 1;
            break;
        case DIR.DOWN:
            y = y + 1;
            break;
    }
    if (unoccupied(current.type, x, y, current.dir)) {
        current.x = x;
        current.y = y;
        invalidate();
        return true;
    } else {
        return false;
    }
}

/**
* Поворачивает текущую фигуру
*/
function rotate() {
    var newdir = (current.dir == DIR.MAX ? DIR.MIN : current.dir + 1);
    if (unoccupied(current.type, current.x, current.y, newdir)) {
        current.dir = newdir;
        invalidate();
    }
}

/**
* Определяет, что будет происходить после того, как очередная деталь стала на место
*/
function drop() {
    if (!move(DIR.DOWN)) {
        addScore(10);
        dropPiece();
        removeLines();
        setCurrentPiece(next);
        setNextPiece(randomPiece());
        clearActions();
        if (occupied(current.type, current.x, current.y, current.dir)) {
            lose();
        }
    }
}

/**
* Опускает деталь вниз экрана
*/
function dropPiece() {
    eachblock(current.type, current.x, current.y, current.dir, function(x, y) {
        setBlock(x, y, current.type);
    });
}

/**
* Удаляет линии, если они заполнилась
*/
function removeLines() {
    var x, y, complete, n = 0;
    for (y = ny; y > 0; --y) {
        complete = true;
        for (x = 0; x < nx; ++x) {
            if (!getBlock(x, y))
                complete = false;
        }
        if (complete) {
            removeLine(y);
            y = y + 1; // recheck same line
            n++;
        }
    }
    if (n > 0) {
        addRows(n);
        addScore(100 * Math.pow(2, n - 1)); // 1: 100, 2: 200, 3: 400, 4: 800
    }
}

/**
* Удаляет линию
*
* @param var $n Тип детали
*/
function removeLine(n) {
    var x, y;
    for (y = n; y >= 0; --y) {
        for (x = 0; x < nx; ++x)
            setBlock(x, y, (y == 0) ? null : getBlock(x, y - 1));
    }
}

//-------------------------------------------------------------------------
// Рендеринг
//-------------------------------------------------------------------------

var invalid = {};

/**
* Аннулирует игровое поле
*/
function invalidate() {
    invalid.court = true;
}

/**
* Аннулирует следующую деталь
*/
function invalidateNext() {
    invalid.next = true;
}

/**
* Аннулирует счёт
*/
function invalidateScore() {
    invalid.score = true;
}

/**
* Аннулирует строки
*/
function invalidateRows() {
    invalid.rows = true;
}

/**
* Рисует окно
*/
function draw() {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.translate(0.5, 0.5); // for crisp 1px black lines
    drawCourt();
    drawNext();
    drawScore();
    drawRows();
    ctx.restore();
}

/**
* Рисует игровое поле
*/
function drawCourt() {
    if (invalid.court) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (playing)
            drawPiece(ctx, current.type, current.x, current.y, current.dir);
        var x, y, block;
        for (y = 0; y < ny; y++) {
            for (x = 0; x < nx; x++) {
                if (block = getBlock(x, y))
                    drawBlock(ctx, x, y, block.color);
            }
        }
        ctx.strokeRect(0, 0, nx * dx - 1, ny * dy - 1); // court boundary
        invalid.court = false;
    }
}

/**
* Рисует следующую деталь
*/
function drawNext() {
    if (invalid.next) {
        var padding = (nu - next.type.size) / 2; // half-arsed attempt at centering next piece display
        uctx.save();
        uctx.translate(0.5, 0.5);
        uctx.clearRect(0, 0, nu * dx, nu * dy);
        drawPiece(uctx, next.type, padding, padding, next.dir);
        uctx.strokeStyle = 'black';
        uctx.strokeRect(0, 0, nu * dx - 1, nu * dy - 1);
        uctx.restore();
        invalid.next = false;
    }
}

/**
* Рисует очки
*/
function drawScore() {
    if (invalid.score) {
        html('score', ("00000" + Math.floor(vscore)).slice(-5));
        invalid.score = false;
    }
}

/**
* Рисует строки
*/
function drawRows() {
    if (invalid.rows) {
        html('rows', rows);
        invalid.rows = false;
    }
}

/**
* Рисует деталь
*/
function drawPiece(ctx, type, x, y, dir) {
    eachblock(type, x, y, dir, function(x, y) {
        drawBlock(ctx, x, y, type.color);
    });
}

/**
* Рисует блок
*/
function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * dx, y * dy, dx, dy);
    ctx.strokeRect(x * dx, y * dy, dx, dy)
}

run();