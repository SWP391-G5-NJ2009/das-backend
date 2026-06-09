function resetPasswordOtp({ otp }) {
  return `DentalCare: Ma OTP dat lai mat khau cua ban la ${otp}. Ma co hieu luc trong 10 phut.`;
}

module.exports = {
  resetPasswordOtp,
};
