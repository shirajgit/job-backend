import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import pdf from "pdf-parse";
import mammoth from "mammoth";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Health check (Railway)
app.get("/", (req, res) => {
  res.status(200).send("✅ Server is running");
});

// ---------- Multer ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or DOCX allowed"));
    }
  },
});

// ---------- Resend ----------
if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL) {
  console.error("❌ Resend env vars missing");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------- Apply Job (NO ATTACHMENT, TEXT ONLY) ----------
app.post("/apply-job", upload.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, experience } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume not uploaded" });
    }

    let resumeText = "";

    // 📄 PDF
    if (req.file.mimetype === "application/pdf") {
      const data = await pdf(req.file.buffer);
      resumeText = data.text;
    }

    // 📄 DOCX
    else {
      const result = await mammoth.extractRawText({
        buffer: req.file.buffer,
      });
      resumeText = result.value;
    }

    // limit text size for email safety
    resumeText = resumeText.replace(/\n{3,}/g, "\n\n").slice(0, 6000);

    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      to: "shirajmujawar03@gmail.com",
      subject: "New Job Application",
      html: `
        <h2>New Job Application</h2>

        <p><b>Name:</b> ${firstName} ${lastName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Experience:</b> ${experience}</p>

        <hr />

        <h3>📄 Resume (Extracted Text)</h3>
        <pre style="white-space:pre-wrap;font-size:13px;">
${resumeText}
        </pre>
      `,
    });

    res.json({
      success: true,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("❌ Apply Job Error:", error);
    res.status(500).json({ message: "Failed to process resume" });
  }
});

// ---------- Contact ----------
app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All required fields missing" });
    }

    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      to: "shirajmujawar03@gmail.com",
      subject: `📩 New Contact Message from ${name}`,
      html: `
        <h2>New Contact Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p>${message}</p>
      `,
    });

    res.json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("❌ Contact Error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ---------- Server ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
