"use strict";

/** SendGrid — geliştirici bir kez API key ayarlar; kullanıcılar yalnızca alıcı adresini girer. */
async function raporMailGonder({ alici, konu, metin, dosyaAdi, xlsIcerik }) {
  const apiKey = process.env.SENDGRID_API_KEY || "";
  const fromRaw = process.env.SENDGRID_FROM || "";
  if (!apiKey) throw new Error("E-posta servisi yapılandırılmamış (SENDGRID_API_KEY)");
  if (!fromRaw) throw new Error("Gönderen adresi yapılandırılmamış (SENDGRID_FROM)");

  const fromEmail = fromRaw.includes("<")
    ? fromRaw.match(/<([^>]+)>/)?.[1] || fromRaw
    : fromRaw.trim();
  const fromName = fromRaw.includes("<")
    ? fromRaw.replace(/<[^>]+>/, "").trim() || "Apartım"
    : "Apartım";

  const icerik = "\ufeff" + xlsIcerik;
  const body = {
    personalizations: [{ to: [{ email: alici }] }],
    from: { email: fromEmail, name: fromName },
    subject: konu,
    content: [{ type: "text/plain", value: metin }],
    attachments: [{
      content: Buffer.from(icerik, "utf8").toString("base64"),
      filename: dosyaAdi,
      type: "application/vnd.ms-excel",
      disposition: "attachment"
    }]
  };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const detay = await res.text();
    console.error("SendGrid hata", res.status, detay);
    throw new Error("E-posta gönderilemedi (" + res.status + ")");
  }
}

module.exports = { raporMailGonder };
