import { sendMail } from "@/lib/email/mailer";
import { getSiteConfig } from "@/lib/site-config/server";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function sendActivationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  const activationUrl = `${APP_URL.replace(/\/$/, "")}/register/verify?token=${encodeURIComponent(token)}`;
  const config = await getSiteConfig();
  const siteName = config.name ?? "Website";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="color:#0f172a">Aktivasi Akun ${siteName}</h2>
      <p>Halo ${name},</p>
      <p>Terima kasih telah mendaftar sebagai penulis di ${siteName}. Klik tombol di bawah ini untuk mengaktifkan akun Anda.</p>
      <p style="margin:24px 0">
        <a href="${activationUrl}" style="background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">Aktifkan Akun</a>
      </p>
      <p>Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke peramban Anda:</p>
      <p><a href="${activationUrl}">${activationUrl}</a></p>
      <p style="color:#64748b">Tautan ini berlaku selama 24 jam.</p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #cbd5f5" />
      <p style="color:#94a3b8;font-size:12px">Email ini dikirim otomatis oleh sistem ${siteName}. Jika Anda tidak merasa mendaftar, abaikan pesan ini.</p>
    </div>
  `;

  const text = `Halo ${name},\n\nAktifkan akun penulis Anda dengan membuka tautan berikut:\n${activationUrl}\n\nTautan berlaku selama 24 jam.\n\n${siteName}`;

  await sendMail({
    to: email,
    subject: `Aktivasi Akun Penulis ${siteName}`,
    html,
    text,
  });
}
