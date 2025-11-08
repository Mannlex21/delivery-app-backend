// src/config/database.ts

import mongoose, { ConnectOptions } from "mongoose";
import { ENV } from "./env.js";

/**
 * Función para establecer la conexión a MongoDB.
 * Utiliza variables de entorno para la URI de conexión.
 */
const connectDB = async (): Promise<void> => {
	// La URI de conexión. En Docker Compose, el nombre del host es 'mongodb' (el nombre del servicio)
	// Usamos process.env.MONGO_URI o un valor por defecto seguro (mongodb://mongodb:27017/mandadosdb)
	const MONGO_URI = ENV.MONGO_URI;

	try {
		// Opciones de conexión recomendadas por Mongoose
		const options: ConnectOptions = {}; // En versiones modernas de Mongoose, no se necesitan opciones específicas

		await mongoose.connect(MONGO_URI, options);

		console.log("✅ MongoDB conectado exitosamente.");

		// Escucha eventos de desconexión para informar al desarrollador
		mongoose.connection.on("disconnected", () => {
			console.warn("⚠️ MongoDB desconectado. Intentando reconectar...");
		});
	} catch (error) {
		console.error("❌ Error fatal al conectar a MongoDB:", error);

		// Finaliza el proceso si la conexión inicial falla
		process.exit(1);
	}
};

export default connectDB;
