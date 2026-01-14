import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.send("✅ Server running");
});

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

// Resend
if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL) {
  throw new Error("Missing RESEND env variables");
}
const resend = new Resend(process.env.RESEND_API_KEY);

// ================= APPLY JOB =================
app.post("/apply-job", upload.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, experience } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume missing" });
    }

    let resumeText = "Could not extract resume text";

    // ---------- PDF ----------
    if (req.file.mimetype === "application/pdf") {
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(req.file.buffer),
      }).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n";
      }
      resumeText = text;
    }

    // ---------- DOCX ----------
    if (
      req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({
        buffer: req.file.buffer,
      });
      resumeText = result.value;
    }

    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      to: "shirajmujawar03@gmail.com",
      subject: "📄 New Job Application",
      html: `
        <h2>New Job Application</h2>
        <p><b>Name:</b> ${firstName} ${lastName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Experience:</b> ${experience}</p>

        <h3>📄 Resume Text</h3>
        <pre style="white-space:pre-wrap;font-size:14px;">
${resumeText.substring(0, 6000)}
        </pre>
      `,
      attachments: [
        {
          name: req.file.originalname,
          data: req.file.buffer.toString("base64"),
          content_type: req.file.mimetype,
        },
      ],
    });

    res.json({ success: true, message: "Application submitted successfully" });
  } catch (err) {
    console.error("❌ Apply Job Error:", err);
    res.status(500).json({ message: "Email sending failed" });
  }
});

// ================= CONTACT =================
app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      to: "shirajmujawar03@gmail.com",
      subject: `📩 Contact from ${name}`,
      html: `
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone || "N/A"}</p>
        <p>${message}</p>
      `,
    });

    res.json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("❌ Contact Error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
