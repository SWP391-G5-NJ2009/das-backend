function todayVietnam() {
    const now = new Date();
    const vn = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
    );
    return `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, "0")}-${String(vn.getDate()).padStart(2, "0")}`;
}

module.exports = { todayVietnam };
