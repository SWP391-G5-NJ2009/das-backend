const supabase = require("../config/supabase");
const AppError = require("../utils/AppError");

async function getAllServices(req, res, next) {
  try {
    const { data: services, error } = await supabase
      .from("dental_services")
      .select(
        `
        service_id,
        category_id,
        service_name,
        description,
        unit_price,
        slot_occupied,
        status,
        service_categories (category_name)
      `,
      )
      .order("service_id", { ascending: true });

    if (error) {
      throw new AppError(
        "Failed to load service list. Please try again later.",
        500,
        "DB_ERROR",
      );
    }

    return res.status(200).json({
      status: "success",
      results: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("dental_services")
      .delete()
      .eq("service_id", id)
      .select();

    if (error) {
      throw new AppError(
        "Failed to delete service. Please try again later.",
        500,
        "DB_ERROR",
      );
    }

    if (!data || data.length === 0) {
      throw new AppError(
        "Failed to find service with the requested ID.",
        404,
        "NOT_FOUND",
      );
    }

    return res.status(200).json({
      status: "success",
      message: "Service deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const {
      service_name,
      category_id,
      description,
      unit_price,
      slot_occupied,
      status,
    } = req.body;

    if (!service_name || !category_id || !unit_price) {
      throw new AppError(
        "Missing required fields: service_name, category_id, or unit_price.",
        400,
        "BAD_REQUEST",
      );
    }

    const { data, error } = await supabase
      .from("dental_services")
      .insert([
        {
          service_name,
          category_id,
          description: description || null,
          unit_price: Number(unit_price),
          slot_occupied: Number(slot_occupied) || 1,
          status: status || "Active",
        },
      ])
      .select();

    if (error) {
      throw new AppError(
        "Failed to create new dental service. Database execution error.",
        500,
        "DB_ERROR",
      );
    }

    return res.status(201).json({
      status: "success",
      message: "Service created successfully!",
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
}

async function getAllCategories(req, res, next) {
  try {
    const { data: categories, error } = await supabase
      .from("service_categories")
      .select("category_id, category_name, description")
      .order("category_id", { ascending: true });

    if (error) {
      throw new AppError(
        "Failed to load service categories. Please try again later.",
        500,
        "DB_ERROR",
      );
    }

    return res.status(200).json({
      status: "success",
      results: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const {
      service_name,
      category_id,
      description,
      unit_price,
      slot_occupied,
      status,
    } = req.body;

    if (!service_name || !category_id || !unit_price) {
      throw new AppError(
        "Service name, category, and price are required fields.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const { data, error } = await supabase
      .from("dental_services")
      .update({
        service_name,
        category_id: Number(category_id),
        description: description || null,
        unit_price: Number(unit_price),
        slot_occupied: Number(slot_occupied) || 1,
        status: status || "Active",
      })
      .eq("service_id", id)
      .select();

    if (error) {
      throw new AppError(
        "Failed to update service. Database error occurred.",
        500,
        "DB_ERROR",
      );
    }

    if (!data || data.length === 0) {
      throw new AppError(
        "Failed to find service with the requested ID to update.",
        404,
        "NOT_FOUND",
      );
    }

    return res.status(200).json({
      status: "success",
      message: "Service updated successfully.",
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllServices,
  deleteService,
  createService,
  getAllCategories,
  updateService,
};
