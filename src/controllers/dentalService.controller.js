const supabase = require("../config/supabase");
const AppError = require("../utils/AppError");

async function getAllServices(req, res, next) {
  try {
    // Truy vấn kết hợp lấy tên danh mục từ bảng service_categories
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
    const { id } = req.params; // Lấy ID dịch vụ từ URL route parameters

    // Thực hiện lệnh xóa trên table "dental_services" của Supabase
    const { data, error } = await supabase
      .from("dental_services")
      .delete()
      .eq("service_id", id) // Khớp đúng với khóa chính service_id trong DB của bạn
      .select(); // Trả về bản ghi vừa xóa để kiểm tra nếu cần

    // Nếu Supabase trả về lỗi (Ví dụ: dính khóa ngoại hoặc mất kết nối)
    if (error) {
      throw new AppError(
        "Failed to delete service. Please try again later.",
        500,
        "DB_ERROR",
      );
    }

    // Nếu không có lỗi nhưng data trả về rỗng (tức là ID không tồn tại trong DB)
    if (!data || data.length === 0) {
      throw new AppError(
        "Failed to find service with the requested ID.",
        404,
        "NOT_FOUND",
      );
    }

    // Trả về response thành công dạng JSON đồng bộ với format chung của nhóm
    return res.status(200).json({
      status: "success",
      message: "Service deleted successfully.",
    });
  } catch (error) {
    next(error); // Chuyển tiếp lỗi qua middleware handle lỗi tập trung
  }
}

// 🔥 HÀM TẠO MỚI DỊCH VỤ NHA KHOA
async function createService(req, res, next) {
  try {
    // Lấy các trường dữ liệu do Frontend gửi lên trong body request
    const {
      service_name,
      category_id,
      description,
      unit_price,
      slot_occupied,
      status,
    } = req.body;

    // Kiểm tra nhanh xem các trường bắt buộc đã được điền chưa
    if (!service_name || !category_id || !unit_price) {
      throw new AppError(
        "Missing required fields: service_name, category_id, or unit_price.",
        400,
        "BAD_REQUEST",
      );
    }

    // Gửi lệnh Chèn (Insert) dòng mới vào bảng "dental_services" trên Supabase
    const { data, error } = await supabase
      .from("dental_services")
      .insert([
        {
          service_name,
          category_id,
          description: description || null,
          unit_price: Number(unit_price), // Đảm bảo lưu đúng kiểu số tiền
          slot_occupied: Number(slot_occupied) || 1, // Mặc định chiếm 1 slot nếu bỏ trống
          status: status || "Active", // Mặc định trạng thái ban đầu hoạt động
        },
      ])
      .select(); // Yêu cầu trả về bản ghi vừa tạo để gửi về cho Frontend

    if (error) {
      throw new AppError(
        "Failed to create new dental service. Database execution error.",
        500,
        "DB_ERROR",
      );
    }

    // Phản hồi thành công kèm data bản ghi mới lập tức
    return res.status(201).json({
      status: "success",
      message: "Service created successfully!",
      data: data[0], // Trả về phần tử đầu tiên vừa chèn
    });
  } catch (error) {
    next(error);
  }
}

// 🔥 HÀM LẤY DANH SÁCH DANH MỤC TỪ DB
async function getAllCategories(req, res, next) {
  try {
    const { data: categories, error } = await supabase
      .from("service_categories") // Tên bảng danh mục của bạn trong DB
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

// 🔥 HÀM CẬP NHẬT/SỬA DỊCH VỤ THEO ID
async function updateService(req, res, next) {
  try {
    const { id } = req.params; // Lấy ID dịch vụ từ URL (VD: /api/v1/dental-services/5)
    const {
      service_name,
      category_id,
      description,
      unit_price,
      slot_occupied,
      status,
    } = req.body;

    // Validate dữ liệu bắt buộc cơ bản giống như hàm Create
    if (!service_name || !category_id || !unit_price) {
      throw new AppError(
        "Service name, category, and price are required fields.",
        400,
        "VALIDATION_ERROR",
      );
    }

    // Thực hiện cập nhật trong bảng "dental_services" của Supabase
    const { data, error } = await supabase
      .from("dental_services")
      .update({
        service_name,
        category_id: Number(category_id),
        description: description || null,
        unit_price: Number(unit_price),
        slot_occupied: Number(slot_occupied) || 1, // Đảm bảo không bị lưu số 0 hoặc null
        status: status || "Active",
      })
      .eq("service_id", id) // Tìm đúng bản ghi có ID này để sửa
      .select(); // Trả dữ liệu về để kiểm tra xem sửa thành công không

    if (error) {
      throw new AppError(
        "Failed to update service. Database error occurred.",
        500,
        "DB_ERROR",
      );
    }

    // Nếu không tìm thấy hàng nào có ID đó để sửa
    if (!data || data.length === 0) {
      throw new AppError(
        "Failed to find service with the requested ID to update.",
        404,
        "NOT_FOUND",
      );
    }

    // Trả về kết quả thành công cho Frontend
    return res.status(200).json({
      status: "success",
      message: "Service updated successfully.",
      data: data[0], // Gửi lại object vừa sửa đổi xong
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
