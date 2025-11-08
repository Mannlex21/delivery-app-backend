// src/controllers/courier.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";

import Courier, { ICourier, CourierStatus } from "../models/Courier.model.js";
import User from "../models/User.model.js";

// Interfaz para el objeto de usuario inyectado por el middleware de autenticación
interface AuthRequest extends Request {
	user?: { userId: string; role: string };
}

// Interfaz para el cuerpo de la petición de creación de perfil
interface ICourierProfileBody {
	vehicleType: string;
	licensePlate: string;
}

/**
 * [POST /couriers] Crea un perfil de repartidor.
 * Solo se permite si el usuario logueado tiene el rol adecuado.
 */
export const createCourierProfile = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const userId = req.user?.userId;
	const userRole = req.user?.role;
	const { vehicleType, licensePlate } = req.body as ICourierProfileBody;

	// 1. Control de acceso: Solo 'courier' o 'admin' pueden crear perfiles de repartidor
	if (userRole !== "courier" && userRole !== "admin") {
		res.status(403).json({
			message: "Permiso denegado. Rol no autorizado.",
		});
		return;
	}

	if (!vehicleType || !licensePlate) {
		res.status(400).json({
			message: "Faltan campos obligatorios para el perfil de repartidor.",
		});
		return;
	}

	try {
		// 2. Validación: Asegurar que el usuario no tiene ya un perfil de repartidor
		const existingProfile = await Courier.findOne({
			user: new Types.ObjectId(userId),
		});
		if (existingProfile) {
			res.status(400).json({
				message: "Ya tienes un perfil de repartidor activo.",
			});
			return;
		}

		// 3. Crear el perfil inicial
		const newCourier = new Courier({
			user: new Types.ObjectId(userId),
			vehicleType,
			licensePlate,
			status: "OFFLINE", // Inicia offline por defecto
		});

		await newCourier.save();

		// Opcional: Asegurarse de que el usuario tenga el rol 'courier'
		await User.findByIdAndUpdate(userId, { role: "courier" });

		res.status(201).json({
			message:
				"Perfil de repartidor creado exitosamente. Estado: OFFLINE.",
			courier: newCourier,
		});
	} catch (error: any) {
		if (error.code === 11000) {
			res.status(400).json({
				message: "La matrícula o el usuario ya están registrados.",
			});
			return;
		}
		console.error("Error al crear perfil de repartidor:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [PATCH /couriers/location] Actualiza la ubicación GeoJSON del repartidor logueado.
 * Esto simula el seguimiento en tiempo real.
 */
export const updateCourierLocation = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const userId = req.user?.userId;
	const { latitude, longitude } = req.body;

	if (!userId || !latitude || !longitude) {
		res.status(400).json({
			message:
				"Se requiere autenticación y coordenadas válidas (latitude, longitude).",
		});
		return;
	}

	try {
		// Formato GeoJSON Point: [longitude, latitude]
		const locationUpdate = {
			type: "Point",
			coordinates: [parseFloat(longitude), parseFloat(latitude)],
		};

		const updatedCourier = await Courier.findOneAndUpdate(
			{ user: new Types.ObjectId(userId) },
			{
				$set: {
					currentLocation: locationUpdate,
					updatedAt: new Date(),
				},
			},
			{ new: true }
		).select("status currentLocation");

		if (!updatedCourier) {
			res.status(404).json({
				message: "Perfil de repartidor no encontrado.",
			});
			return;
		}

		// Nota: En un sistema real, esta ubicación se enviaría a través de WebSockets.

		res.status(200).json({
			message: "Ubicación actualizada.",
			location: updatedCourier.currentLocation,
		});
	} catch (error) {
		console.error("Error al actualizar ubicación:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [PATCH /couriers/status] Actualiza el estado del repartidor (OFFLINE/AVAILABLE/BUSY).
 */
export const updateCourierStatus = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const userId = req.user?.userId;
	const { status } = req.body;

	if (!userId || !status) {
		res.status(400).json({
			message: "Se requiere autenticación y el nuevo estado (status).",
		});
		return;
	}

	// Validación de estado (asegurar que el nuevo estado es válido según el enum)
	const validStatus = ["OFFLINE", "AVAILABLE", "BUSY"] as CourierStatus[];
	if (!validStatus.includes(status)) {
		res.status(400).json({
			message: `Estado inválido: ${status}. Debe ser OFFLINE, AVAILABLE o BUSY.`,
		});
		return;
	}

	try {
		const updatedCourier = await Courier.findOneAndUpdate(
			{ user: new Types.ObjectId(userId) },
			{ $set: { status: status, updatedAt: new Date() } },
			{ new: true, runValidators: true }
		).select("status");

		if (!updatedCourier) {
			res.status(404).json({
				message: "Perfil de repartidor no encontrado.",
			});
			return;
		}

		res.status(200).json({
			message: `Estado actualizado a ${status}.`,
			status: updatedCourier.status,
		});
	} catch (error) {
		console.error("Error al actualizar estado:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [GET /couriers/available] Busca repartidores disponibles cerca de una ubicación (ej: cerca de una tienda).
 */
export const getAvailableCouriers = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	const { latitude, longitude, radius } = req.query; // radio en metros

	if (!latitude || !longitude || !radius) {
		res.status(400).json({
			message:
				"Se requieren coordenadas (latitude, longitude) y radio (radius) de búsqueda.",
		});
		return;
	}

	try {
		const lat = parseFloat(latitude as string);
		const lon = parseFloat(longitude as string);
		const distance = parseInt(radius as string, 10);

		// Búsqueda Geoespacial: encontrar repartidores disponibles cerca del punto dado.
		const nearbyAvailableCouriers = await Courier.aggregate([
			{
				$geoNear: {
					near: { type: "Point", coordinates: [lon, lat] },
					distanceField: "distance", // Calcula la distancia
					maxDistance: distance, // Distancia máxima en metros
					spherical: true,
					query: { status: "AVAILABLE" }, // FILTRO CLAVE: Solo buscar disponibles
				},
			},
			{
				$lookup: {
					// Opcional: Traer el nombre del usuario vinculado
					from: "users",
					localField: "user",
					foreignField: "_id",
					as: "userDetails",
				},
			},
			{ $unwind: "$userDetails" },
			{
				$project: {
					// Proyectar solo los datos necesarios
					_id: 1,
					vehicleType: 1,
					status: 1,
					distance: { $round: ["$distance", 0] },
					name: "$userDetails.name",
					phone: "$userDetails.phone",
				},
			},
		]);

		res.status(200).json(nearbyAvailableCouriers);
	} catch (error) {
		console.error("Error al buscar repartidores disponibles:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};
