import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import {Resend} from "resend";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Multer Memory Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

app.get("/", (req, res) => {
  res.send("Job Application Backend is running");
});

// ---------- Apply Job ----------
app.post("/apply-job", upload.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, experience } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume not uploaded" });
    }

    await resend.emails.send({
      from: process.env.RESEND_EMAIL, // Your verified sender email
      to: email,   // Where you want to receive applications
      subject: "New Job Application",
      html: `
        <h3>New Job Application</h3>
        <p><b>Name:</b> ${firstName} ${lastName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Experience:</b> ${experience}</p>
      `,
      attachments: [
        {
          name: req.file.originalname,
          data: req.file.buffer.toString("base64"), // Resend expects base64
        },
      ],
    });

    res.json({ success: true, message: "Application submitted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Email sending failed" });
  }
});

// ---------- Contact ----------
app.post("/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "All required fields missing" });
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      to: process.env.RESEND_EMAIL,
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ---------- Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
