// src/routes/store.routes.ts

import { Router } from "express";
// Asegúrate de que las rutas relativas sean correctas (.js por ESM)
import { isAuthenticated } from "../middleware/auth.middleware.js";
import * as storeController from "../controllers/store.controller.js";

const router = Router();

// POST /stores: Crear una nueva tienda (Solo dueños de tienda o admins)
router.post("/", isAuthenticated, storeController.createStore);

// GET /stores: Obtener listado de tiendas. SOPORTA BÚSQUEDA GEOSESPACIAL.
router.get("/", storeController.getStores);

// GET /stores/my: Obtener la tienda del usuario logueado (si es dueño de una)
router.get("/my", isAuthenticated, storeController.getMyStore);

// GET /stores/:id: Obtener detalles de una tienda específica (Público)
router.get("/:id", storeController.getStoreDetails);

// PATCH /stores/:id: Actualizar información de la tienda (Solo el dueño)
router.patch("/:id", isAuthenticated, storeController.updateStore);

export default router;
