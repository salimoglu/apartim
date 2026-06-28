"use strict";

const nodemailer = require("nodemailer");

function smtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user;
  if (!user || !pass) {
    throw new Error("SMTP_USER ve SMTP_PASS tanımlı değil (Firebase secrets)");
  }
  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from
  };
}

async function raporMailGonder({ alici, konu, metin, dosyaAdi, xlsIcerik }) {
  const cfg = smtpConfig();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth
  });

  await transporter.sendMail({
    from: cfg.from,
    to: alici,
    subject: konu,
    text: metin,
    html: "<p>" + metin.replace(/\n/g, "<br>") + "</p>",
    attachments: [{
      filename: dosyaAdi,
      content: "\ufeff" + xlsIcerik,
      contentType: "application/vnd.ms-excel;charset=utf-8"
    }]
  });
}

module.exports = { raporMailGonder, smtpConfig };
