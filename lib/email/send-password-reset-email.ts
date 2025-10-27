import { sendMail } from "@/lib/email/mailer";
import { getSiteConfig } from "@/lib/site-config/server";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function sendPasswordResetEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string | null;
  token: string;
}) {
  const safeName = name?.trim() || "Pengguna";
  const resetUrl = `${APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const config = await getSiteConfig();
  const siteName = config.name ?? "Website";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="color:#0f172a">Permintaan Reset Password</h2>
      <p>Halo ${safeName},</p>
      <p>Kami menerima permintaan untuk mereset password akun Anda di ${siteName}. Klik tombol di bawah ini untuk membuat password baru.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">Reset Password</a>
      </p>
      <p>Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke peramban Anda:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="color:#64748b">Tautan ini hanya berlaku selama 30 menit. Abaikan email ini jika Anda tidak meminta reset password.</p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #cbd5f5" />
      <p style="color:#94a3b8;font-size:12px">Email ini dikirim otomatis oleh sistem ${siteName}. Jika Anda tidak merasa meminta reset password, abaikan pesan ini.</p>
    </div>
  `;

  const text = `Halo ${safeName},\n\nGunakan tautan berikut untuk mereset password akun Anda:\n${resetUrl}\n\nTautan berlaku selama 30 menit. Abaikan email ini jika Anda tidak meminta reset password.\n\n${siteName}`;

  await sendMail({
    to: email,
    subject: `Reset Password Akun ${siteName}`,
    html,
    text,
  });
}
