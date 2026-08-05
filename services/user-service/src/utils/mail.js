import nodemailer from "nodemailer";

export const sendResetPasswordEmail = async (email, token) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    // 1. Luôn in link ra console log để thuận tiện cho việc kiểm thử môi trường Local/Development
    console.log(`\n======================================================================`);
    console.log(`🔑 [PASSWORD RESET REQUEST]`);
    console.log(`To: ${email}`);
    console.log(`Link: ${resetUrl}`);
    console.log(`======================================================================\n`);

    // 2. Nếu có cấu hình SMTP (như Mailtrap hoặc Gmail), gửi mail thực tế
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || "587"),
                secure: process.env.SMTP_PORT === "465", // true cho 465, false cho các cổng khác
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_FROM || '"SocialHub" <no-reply@socialhub.com>',
                to: email,
                subject: "[SocialHub] Đặt lại mật khẩu của bạn",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                        <h2 style="color: #2563eb; text-align: center; margin-bottom: 20px;">SocialHub</h2>
                        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Xin chào,</p>
                        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản SocialHub của bạn. Vui lòng nhấp vào nút dưới đây để tiến hành đặt mật khẩu mới:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">Đặt lại mật khẩu</a>
                        </div>
                        <p style="font-size: 12px; color: #64748b; line-height: 1.6;">Đường dẫn này có hiệu lực trong vòng 1 giờ. Nếu bạn không gửi yêu cầu này, bạn có thể an tâm bỏ qua email này.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 SocialHub. All rights reserved.</p>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log(`📧 Đã gửi email reset mật khẩu tới thành công: ${email}`);
        } catch (error) {
            console.error(`❌ Gặp lỗi khi gửi email qua SMTP:`, error.message);
        }
    } else {
        console.log(`ℹ️ Chưa cấu hình đầy đủ SMTP_HOST, SMTP_USER hoặc SMTP_PASS. Bỏ qua gửi email thực tế.`);
    }
};
