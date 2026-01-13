import express from "express";
import nodemailer from "nodemailer";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- Multer (Resume Upload in memory) ----------------
const upload = multer({ storage: multer.memoryStorage() });

// ---------------- Nodemailer Transporter (SendGrid) ----------------
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  auth: {
    user: "apikey", // This is SendGrid's required username
    pass: process.env.SENDGRID_API_KEY, // Put your SendGrid API key in .env
  },
});

// ✅ Optional: verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("Mailer verification failed:", error);
  } else {
    console.log("Mailer ready to send emails");
  }
});

// ---------------- /apply-job Route ----------------
app.post("/apply-job", upload.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, experience } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume not uploaded" });
    }

    const mailOptions = {
      from: `"Career Form" <${process.env.EMAIL}>`,
      to: process.env.EMAIL, // Company email
      replyTo: email,        // Applicant email
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
          filename: req.file.originalname,
          content: req.file.buffer, // Use memory buffer
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("MAIL ERROR 👉", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed",
    });
  }
});

// ---------------- /contact Route ----------------
app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All required fields missing" });
    }

    const mailOptions = {
      from: email,
      to: process.env.EMAIL,
      subject: `📩 New Contact Message from ${name}`,
      html: `
        <h2>New Contact Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("MAIL ERROR 👉", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

// ---------------- Server ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
