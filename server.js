import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Health check (Render / Railway needs this)
app.get("/", (req, res) => {
  res.status(200).send("✅ Server is running");
});

// ✅ Multer memory storage
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

// ✅ ENV CHECK
if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL) {
  console.error("❌ Missing RESEND env variables");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

// ================= APPLY JOB =================
app.post("/apply-job", upload.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, experience } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume not uploaded" });
    }

    let resumeText = "❌ Could not extract resume text";

    // ✅ PDF
    if (req.file.mimetype === "application/pdf") {
      const data = await pdfParse(req.file.buffer);
      resumeText = data.text;
    }

    // ✅ DOCX
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

    res.json({
      success: true,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("❌ Apply Job Error:", error);
    res.status(500).json({ message: "Email sending failed" });
  }
});

// ================= CONTACT =================
app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Missing fields" });
    }

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
  } catch (error) {
    console.error("❌ Contact Error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
