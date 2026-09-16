const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());
// Servir carpetas públicas en la web
app.use('/admin', express.static(path.join(__dirname, '../ADMIN')));
app.use('/comprador', express.static(path.join(__dirname, '../COMPRADOR')));
app.use('/vendedor', express.static(path.join(__dirname, '../VENDEDOR')));
app.use('/uploads', express.static(path.join(__dirname, '../Uploads')));
/* =========================
   ALMACENAMIENTO TEMPORAL
   ========================= */

let tiendas = [
    {
        id: 1,
        nombre: "Tienda Demo",
        vendedor: "Vendedor Demo"
    }
];

let productos = [
    {
        id: 1,
        tiendaId: 1,
        nombre: "Camiseta negra",
        precio: 15000,
        categoria: "Ropa",
        descripcion: "Camiseta negra de manga corta",
        imagen: null
    }
];

let siguienteProductoId = 2;
let siguienteTiendaId = 2;

/* =========================
   ARCHIVOS
   ========================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../uploads"));
    },

    filename: function (req, file, cb) {
        const nombre = Date.now() + "-" + file.originalname;
        cb(null, nombre);
    }
});

const upload = multer({ storage });

/* =========================
   TIENDAS
   ========================= */

app.get("/api/tiendas", (req, res) => {
    res.json(tiendas);
});

app.post("/api/tiendas", (req, res) => {

    const { nombre, vendedor } = req.body;

    if (!nombre || !vendedor) {
        return res.status(400).json({
            error: "Nombre de tienda y vendedor son obligatorios"
        });
    }

    const nuevaTienda = {
        id: siguienteTiendaId++,
        nombre,
        vendedor
    };

    tiendas.push(nuevaTienda);

    res.status(201).json(nuevaTienda);
});

/* =========================
   PRODUCTOS
   ========================= */

app.get("/api/productos", (req, res) => {

    const productosConTienda = productos.map(producto => {

        const tienda = tiendas.find(
            tienda => tienda.id === producto.tiendaId
        );

        return {
            ...producto,
            tienda: tienda ? tienda.nombre : "Tienda desconocida"
        };
    });

    res.json(productosConTienda);
});


app.post("/api/productos", upload.single("imagen"), (req, res) => {

    const {
        tiendaId,
        nombre,
        precio,
        categoria,
        descripcion
    } = req.body;

    if (!tiendaId || !nombre || !precio) {

        return res.status(400).json({
            error: "Tienda, nombre y precio son obligatorios"
        });
    }

    const nuevaImagen = req.file
        ? `/uploads/${req.file.filename}`
        : null;

    const nuevoProducto = {

        id: siguienteProductoId++,

        tiendaId: Number(tiendaId),

        nombre,

        precio: Number(precio),

        categoria: categoria || "Sin categoría",

        descripcion: descripcion || "",

        imagen: nuevaImagen
    };

    productos.push(nuevoProducto);

    res.status(201).json(nuevoProducto);
});


/* =========================
   ELIMINAR PRODUCTO
   ========================= */

app.delete("/api/productos/:id", (req, res) => {

    const id = Number(req.params.id);

    const posicion = productos.findIndex(
        producto => producto.id === id
    );

    if (posicion === -1) {

        return res.status(404).json({
            error: "Producto no encontrado"
        });
    }

    productos.splice(posicion, 1);

    res.json({
        mensaje: "Producto eliminado correctamente"
    });
});


/* =========================
   IA — PRIMERA ESTRUCTURA
   ========================= */

app.post("/api/ia/analizar-producto", upload.single("imagen"), (req, res) => {

    /*
       TODAVÍA NO CONECTAMOS UN MODELO DE IA.

       Esta ruta está preparada para que posteriormente
       conectemos el sistema de visión artificial.
    */

    res.json({

        mensaje: "Imagen recibida correctamente",

        analisis: {

            categoria: "Ropa",

            tipo: "Producto no identificado todavía",

            color: "Pendiente de IA",

            confianza: 0

        }
    });
});


/* =========================
   SERVIDOR DE ARCHIVOS
   ========================= */

app.use(
    "/uploads",
    express.static(path.join(__dirname, "../uploads"))
);


/* =========================
   INICIO
   ========================= */

app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log("MARKETPLACE BACKEND");
    console.log("--------------------------------");

    console.log(`Backend: http://localhost:${PORT}`);

});