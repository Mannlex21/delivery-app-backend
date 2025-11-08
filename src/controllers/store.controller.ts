// src/controllers/store.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";

import Store, { IStore, IStoreAddress } from "../models/Store.model.js";
import User from "../models/User.model.js";

// Interfaz para el cuerpo de la petición de creación/actualización
interface IStoreBody {
	name: string;
	phone: string;
	email: string;
	address: IStoreAddress;
}

// Interfaz para el objeto de usuario inyectado por el middleware de autenticación
interface AuthRequest extends Request {
	user?: { userId: string; role: string }; // Asumimos que el token incluye el ID y el rol
}

/**
 * [POST /stores] Crea una nueva tienda.
 * La tienda creada se vincula automáticamente al usuario autenticado.
 */
export const createStore = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const userId = req.user?.userId;
	const userRole = req.user?.role;
	const { name, phone, email, address } = req.body as IStoreBody;

	// Control de acceso: Solo roles específicos pueden crear tiendas
	if (userRole !== "store" && userRole !== "admin") {
		res.status(403).json({
			message:
				"Permiso denegado. Rol no autorizado para crear una tienda.",
		});
		return;
	}

	if (!name || !phone || !email || !address) {
		res.status(400).json({
			message: "Faltan campos obligatorios para crear la tienda.",
		});
		return;
	}

	try {
		// Validación de unicidad: Prevenir que un usuario cree múltiples tiendas (opcional)
		const existingStore = await Store.findOne({
			owner: new Types.ObjectId(userId),
		});
		if (existingStore) {
			res.status(400).json({ message: "Ya eres dueño de una tienda." });
			return;
		}

		// Construir el campo GeoJSON 'location' para búsquedas espaciales
		const location = {
			type: "Point",
			// ¡IMPORTANTE!: GeoJSON/Mongoose usa el orden [longitude, latitude]
			coordinates: [address.longitude, address.latitude],
		};

		const newStore = new Store({
			name,
			owner: new Types.ObjectId(userId),
			phone,
			email,
			address,
			location,
			isActive: true,
		});

		await newStore.save();

		// Opcional: Si el usuario era 'client', actualizar su rol a 'store'
		// await User.findByIdAndUpdate(userId, { role: 'store' });

		res.status(201).json({
			message: "Tienda creada exitosamente.",
			store: newStore,
		});
	} catch (error: any) {
		if (error.code === 11000) {
			res.status(400).json({
				message: "El email o nombre de la tienda ya están registrados.",
			});
			return;
		}
		console.error("Error al crear tienda:", error);
		res.status(500).json({
			message: "Error interno del servidor al crear la tienda.",
		});
	}
};

/**
 * [GET /stores] Obtiene una lista de tiendas, soportando búsqueda geoespacial.
 * Parámetros de Query para búsqueda por proximidad: latitude, longitude, maxDistance (en metros).
 */
export const getStores = async (req: Request, res: Response): Promise<void> => {
	try {
		const { latitude, longitude, maxDistance } = req.query;

		// Búsqueda Geoespacial (cercanía)
		if (latitude && longitude && maxDistance) {
			const lat = parseFloat(latitude as string);
			const lon = parseFloat(longitude as string);
			const distance = parseInt(maxDistance as string, 10) || 10000; // Por defecto 10 km

			if (isNaN(lat) || isNaN(lon) || isNaN(distance)) {
				res.status(400).json({
					message: "Coordenadas o distancia no válidas.",
				});
				return;
			}

			// Usamos $geoNear (Aggregate) para buscar por proximidad eficientemente
			const nearbyStores = await Store.aggregate([
				{
					$geoNear: {
						near: {
							type: "Point",
							coordinates: [lon, lat], // [longitude, latitude]
						},
						distanceField: "distance", // Calcula la distancia y la añade a cada documento
						maxDistance: distance, // Distancia máxima en metros
						spherical: true,
						query: { isActive: true }, // Solo buscar entre tiendas activas
					},
				},
				{
					$project: {
						// Seleccionar y formatear los campos a devolver
						name: 1,
						address: 1,
						phone: 1,
						distance: { $round: ["$distance", 0] }, // Redondear la distancia a metros
					},
				},
			]);

			res.status(200).json(nearbyStores);
			return;
		}

		// Búsqueda simple (Si no hay parámetros geoespaciales)
		const allActiveStores = await Store.find({ isActive: true }).select(
			"name address phone email"
		);

		res.status(200).json(allActiveStores);
	} catch (error) {
		console.error("Error al obtener tiendas:", error);
		res.status(500).json({
			message: "Error interno del servidor al consultar tiendas.",
		});
	}
};

/**
 * [GET /stores/my] Obtiene la tienda asociada al usuario logueado.
 */
export const getMyStore = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const userId = req.user?.userId;

	if (!userId) {
		res.status(401).json({ message: "Usuario no autenticado." });
		return;
	}

	try {
		const store = await Store.findOne({
			owner: new Types.ObjectId(userId),
		}).select("-owner");

		if (!store) {
			res.status(404).json({
				message: "No se encontró una tienda asociada a este usuario.",
			});
			return;
		}

		res.status(200).json(store);
	} catch (error) {
		console.error("Error al obtener mi tienda:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [GET /stores/:id] Obtiene los detalles de una tienda específica.
 */
export const getStoreDetails = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const storeId = req.params.id;

		const store = await Store.findById(storeId).select("-owner"); // Ocultar el ID del dueño

		if (!store) {
			res.status(404).json({ message: "Tienda no encontrada." });
			return;
		}

		res.status(200).json(store);
	} catch (error) {
		console.error("Error al obtener detalles de la tienda:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [PATCH /stores/:id] Actualiza la información de una tienda.
 * Solo el dueño de la tienda puede modificarla.
 */
export const updateStore = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const storeId = req.params.id;
	const userId = req.user?.userId;
	const updates = req.body;

	if (!userId) {
		res.status(401).json({ message: "Usuario no autenticado." });
		return;
	}

	try {
		const store = await Store.findById(storeId);

		if (!store) {
			res.status(404).json({ message: "Tienda no encontrada." });
			return;
		}

		// 1. Comprobación de propiedad (Autorización)
		if (store.owner.toString() !== userId) {
			res.status(403).json({
				message:
					"Permiso denegado. Solo el dueño puede modificar esta tienda.",
			});
			return;
		}

		// 2. Si se actualiza la dirección (coordenadas), se debe actualizar el campo GeoJSON 'location'
		if (
			updates.address &&
			updates.address.latitude &&
			updates.address.longitude
		) {
			updates.location = {
				type: "Point",
				coordinates: [
					updates.address.longitude,
					updates.address.latitude,
				],
			};
		}

		// 3. Realizar la actualización
		const updatedStore = await Store.findByIdAndUpdate(
			storeId,
			{ $set: updates, updatedAt: new Date() },
			{ new: true, runValidators: true }
		).select("-owner");

		res.status(200).json({
			message: "Tienda actualizada exitosamente.",
			store: updatedStore,
		});
	} catch (error) {
		console.error("Error al actualizar la tienda:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};
