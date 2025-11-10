// server.ts
import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import orderRoutes from "./routes/order.routes.js";
import storeRoutes from "./routes/store.routes.js";
import courierRoutes from "./routes/courier.routes.js";
import cors from "cors";
import path from "node:path";

dotenv.config();

// Llama a la función de conexión justo antes de iniciar el servidor o al inicio del archivo
connectDB();

const app = express();
const port = 3000;
const simpleLogger = (req: Request, res: Response, next: Function) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	next();
};

app.use(simpleLogger);
app.use(
	cors({
		origin: "*", // En desarrollo, '*' es conveniente. En producción, especifica el dominio.
		methods: ["GET", "POST", "PUT", "DELETE"], // Métodos permitidos
		allowedHeaders: ["Content-Type", "Authorization"], // 💡 CRUCIAL: Autoriza Content-Type y Authorization
	})
);
// Middleware y Rutas (aquí es donde cargarás las rutas en el futuro)
app.use(express.json());
const __dirname = path.resolve();
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/auth", authRoutes);
app.use("/orders", orderRoutes);
app.use("/store", storeRoutes);
app.use("/couriers", courierRoutes);
app.get("/", (req: Request, res: Response) => {
	res.send("API de Mandados Corriendo con Docker");
});

app.listen(port, () => {
	console.log(
		`⚡️ Servidor Node corriendo en el puerto ${port} (dentro del contenedor)`
	);
});
