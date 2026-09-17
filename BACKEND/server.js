const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "cambia_esto_en_produccion";

app.use(cors());
app.use(express.json());

app.use('/admin', express.static(path.join(__dirname, '../ADMIN')));
app.use('/comprador', express.static(path.join(__dirname, '../COMPRADOR')));
app.use('/vendedor', express.static(path.join(__dirname, '../VENDEDOR')));
app.use('/uploads', express.static(path.join(__dirname, '../Uploads')));

/* =========================
   ALMACENAMIENTO TEMPORAL
   ========================= */

let tiendas = [
    { id: 1, nombre: "Tienda Demo", vendedor: "Vendedor Demo" }
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

let repartidores = [];
let pedidos = [];
let usuarios = [];

let siguienteProductoId = 2;
let siguienteTiendaId = 2;
let siguienteRepartidorId = 1;
let siguientePedidoId = 1;
let siguienteUsuarioId = 1;

/* =========================
   ARCHIVOS
   ========================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../Uploads"));
    },
    filename: function (req, file, cb) {
        const nombre = Date.now() + "-" + file.originalname;
        cb(null, nombre);
    }
});

const upload = multer({ storage });

/* =========================
   MIDDLEWARES DE SEGURIDAD
   ========================= */

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token no proporcionado" });
    }

    try {
        req.usuario = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
}

function permitirRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ error: "No tienes permiso para realizar esta acción" });
        }
        next();
    };
}

/* =========================
   TIENDAS
   ========================= */

app.get("/api/tiendas", (req, res) => {
    res.json(tiendas);
});

app.post("/api/tiendas", (req, res) => {
    const { nombre, vendedor } = req.body;

    if (!nombre || !vendedor) {
        return res.status(400).json({ error: "Nombre de tienda y vendedor son obligatorios" });
    }

    const nuevaTienda = { id: siguienteTiendaId++, nombre, vendedor };
    tiendas.push(nuevaTienda);

    res.status(201).json(nuevaTienda);
});

/* =========================
   PRODUCTOS
   ========================= */

app.get("/api/productos", (req, res) => {
    const productosConTienda = productos.map(producto => {
        const tienda = tiendas.find(t => t.id === producto.tiendaId);
        return { ...producto, tienda: tienda ? tienda.nombre : "Tienda desconocida" };
    });

    res.json(productosConTienda);
});

app.post(
    "/api/productos",
    verificarToken,
    permitirRoles("vendedor"),
    upload.single("imagen"),
    (req, res) => {
        const { nombre, precio, categoria, descripcion } = req.body;

        if (!nombre || !precio) {
            return res.status(400).json({ error: "Nombre y precio son obligatorios" });
        }

        const nuevaImagen = req.file ? `/uploads/${req.file.filename}` : null;

        const nuevoProducto = {
            id: siguienteProductoId++,
            tiendaId: req.usuario.tiendaId,
            nombre,
            precio: Number(precio),
            categoria: categoria || "Sin categoría",
            descripcion: descripcion || "",
            imagen: nuevaImagen
        };

        productos.push(nuevoProducto);
        res.status(201).json(nuevoProducto);
    }
);

app.delete("/api/productos/:id", (req, res) => {
    const id = Number(req.params.id);
    const posicion = productos.findIndex(p => p.id === id);

    if (posicion === -1) {
        return res.status(404).json({ error: "Producto no encontrado" });
    }

    productos.splice(posicion, 1);
    res.json({ mensaje: "Producto eliminado correctamente" });
});

/* =========================
   REPARTIDORES
   ========================= */

app.post("/api/repartidores", (req, res) => {
    const { nombre, telefono, vehiculo, zona } = req.body;

    if (!nombre || !telefono || !vehiculo) {
        return res.status(400).json({ error: "Nombre, teléfono y vehículo son obligatorios" });
    }

    const nuevoRepartidor = {
        id: siguienteRepartidorId++,
        nombre,
        telefono,
        vehiculo,
        zona: zona || "Sin especificar",
        disponible: true,
        entregasCompletadas: 0
    };

    repartidores.push(nuevoRepartidor);
    res.status(201).json(nuevoRepartidor);
});

app.get("/api/repartidores", (req, res) => {
    res.json(repartidores);
});

app.patch("/api/repartidores/:id/disponibilidad", (req, res) => {
    const id = Number(req.params.id);
    const { disponible } = req.body;

    const repartidor = repartidores.find(r => r.id === id);

    if (!repartidor) {
        return res.status(404).json({ error: "Repartidor no encontrado" });
    }

    repartidor.disponible = Boolean(disponible);
    res.json(repartidor);
});

app.delete("/api/repartidores/:id", (req, res) => {
    const id = Number(req.params.id);
    const posicion = repartidores.findIndex(r => r.id === id);

    if (posicion === -1) {
        return res.status(404).json({ error: "Repartidor no encontrado" });
    }

    repartidores.splice(posicion, 1);
    res.json({ mensaje: "Repartidor eliminado correctamente" });
});

/* =========================
   PEDIDOS Y ENTREGAS
   ========================= */

app.post("/api/pedidos", (req, res) => {
    const { productoId, comprador, direccionEntrega } = req.body;

    if (!productoId || !comprador || !direccionEntrega) {
        return res.status(400).json({ error: "Producto, comprador y dirección de entrega son obligatorios" });
    }

    const producto = productos.find(p => p.id === Number(productoId));

    if (!producto) {
        return res.status(404).json({ error: "Producto no encontrado" });
    }

    const nuevoPedido = {
        id: siguientePedidoId++,
        productoId: producto.id,
        producto: producto.nombre,
        comprador,
        direccionEntrega,
        repartidorId: null,
        estado: "pendiente",
        fechaCreacion: new Date()
    };

    pedidos.push(nuevoPedido);
    res.status(201).json(nuevoPedido);
});

app.get("/api/pedidos", (req, res) => {
    res.json(pedidos);
});

app.patch("/api/pedidos/:id/asignar", (req, res) => {
    const id = Number(req.params.id);
    const pedido = pedidos.find(p => p.id === id);

    if (!pedido) {
        return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const repartidorDisponible = repartidores.find(r => r.disponible);

    if (!repartidorDisponible) {
        return res.status(409).json({ error: "No hay repartidores disponibles en este momento" });
    }

    pedido.repartidorId = repartidorDisponible.id;
    pedido.estado = "asignado";
    repartidorDisponible.disponible = false;

    res.json(pedido);
});

app.patch("/api/pedidos/:id/estado", verificarToken, (req, res) => {
    const id = Number(req.params.id);
    const { estado } = req.body;
    const estadosValidos = ["pendiente", "asignado", "en_camino", "entregado"];

    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "Estado inválido. Usa: " + estadosValidos.join(", ") });
    }

    const pedido = pedidos.find(p => p.id === id);

    if (!pedido) {
        return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const puedeActualizar = req.usuario.rol === "admin" || req.usuario.repartidorId === pedido.repartidorId;

    if (!puedeActualizar) {
        return res.status(403).json({ error: "Solo el repartidor asignado o un admin puede actualizar este pedido" });
    }

    pedido.estado = estado;

    if (estado === "entregado" && pedido.repartidorId) {
        const repartidor = repartidores.find(r => r.id === pedido.repartidorId);
        if (repartidor) {
            repartidor.disponible = true;
            repartidor.entregasCompletadas++;
        }
    }

    res.json(pedido);
});

app.get("/api/repartidores/:id/pedidos", (req, res) => {
    const id = Number(req.params.id);
    const pedidosDelRepartidor = pedidos.filter(p => p.repartidorId === id);
    res.json(pedidosDelRepartidor);
});

/* =========================
   USUARIOS Y AUTENTICACIÓN
   ========================= */

app.post("/api/auth/registro", async (req, res) => {
    const { nombre, email, password, rol, vehiculo, zona, codigoAdmin } = req.body;
    const rolesPermitidos = ["comprador", "vendedor", "repartidor", "admin"];

    if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: "Nombre, email, contraseña y rol son obligatorios" });
    }

    if (!rolesPermitidos.includes(rol)) {
        return res.status(400).json({ error: "Rol inválido. Usa: " + rolesPermitidos.join(", ") });
    }

    if (usuarios.find(u => u.email === email)) {
        return res.status(409).json({ error: "Ese email ya está registrado" });
    }

    if (rol === "admin") {
        const CODIGO_ADMIN = process.env.ADMIN_CODE || "cambia_este_codigo";
        if (codigoAdmin !== CODIGO_ADMIN) {
            return res.status(403).json({ error: "Código de administrador incorrecto" });
        }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = {
        id: siguienteUsuarioId++,
        nombre,
        email,
        passwordHash,
        rol,
        tiendaId: null,
        repartidorId: null
    };

    if (rol === "vendedor") {
        const nuevaTienda = {
            id: siguienteTiendaId++,
            nombre: `Tienda de ${nombre}`,
            vendedor: nombre
        };
        tiendas.push(nuevaTienda);
        nuevoUsuario.tiendaId = nuevaTienda.id;
    }

    if (rol === "repartidor") {
        if (!vehiculo) {
            return res.status(400).json({ error: "Los repartidores deben indicar su vehículo" });
        }
        const nuevoRepartidor = {
            id: siguienteRepartidorId++,
            nombre,
            telefono: "",
            vehiculo,
            zona: zona || "Sin especificar",
            disponible: true,
            entregasCompletadas: 0
        };
        repartidores.push(nuevoRepartidor);
        nuevoUsuario.repartidorId = nuevoRepartidor.id;
    }

    usuarios.push(nuevoUsuario);

    const token = jwt.sign(
        { id: nuevoUsuario.id, rol: nuevoUsuario.rol, tiendaId: nuevoUsuario.tiendaId, repartidorId: nuevoUsuario.repartidorId },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.status(201).json({
        token,
        usuario: {
            id: nuevoUsuario.id,
            nombre: nuevoUsuario.nombre,
            email: nuevoUsuario.email,
            rol: nuevoUsuario.rol,
            tiendaId: nuevoUsuario.tiendaId,
            repartidorId: nuevoUsuario.repartidorId
        }
    });
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }

    const usuario = usuarios.find(u => u.email === email);

    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
        { id: usuario.id, rol: usuario.rol, tiendaId: usuario.tiendaId, repartidorId: usuario.repartidorId },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.json({
        token,
        usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            tiendaId: usuario.tiendaId,
            repartidorId: usuario.repartidorId
        }
    });
});

/* =========================
   IA — PRIMERA ESTRUCTURA
   ========================= */

app.post("/api/ia/analizar-producto", upload.single("imagen"), (req, res) => {
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
   INICIO
   ========================= */

app.listen(PORT, () => {
    console.log("--------------------------------");
    console.log("MARKETPLACE BACKEND");
    console.log("--------------------------------");
    console.log(`Backend: http://localhost:${PORT}`);
});