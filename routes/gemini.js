const express = require("express");
const axios = require("axios");
const { sodium, b64, getServerKeyPair } = require("../cryptos/crypto");
const pool = require("../db");
const conversations = require("../conversations");
const chrono = require("chrono-node");
const decryptBody = require("../cryptos/decryptBody");
const encryptForClient = require("../cryptos/encryptBody");

const router = express.Router();

router.post("/gemini", decryptBody, async (req, res) => {
  try {
    const payload = req.decrypted;
    const { prompt, files, sessionId } = payload;
    
    const { ephemeral_pub } = payload;
    if (!ephemeral_pub) {
      return res.status(400).json({ error: "Missing ephemeral_pub" });
    }

    const serverKeyPair = require("../cryptos/crypto").getServerKeyPair();

    const clientPub = sodium.from_base64(ephemeral_pub, sodium.base64_variants.ORIGINAL);
    const sessionKeys = sodium.crypto_kx_server_session_keys(
      serverKeyPair.publicKey,
      serverKeyPair.privateKey,
      clientPub
    );

    if (!prompt) {
      return res
        .status(400)
        .json({ error: "Decrypted payload missing prompt" });
    }

    // 3) Retrieve or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, [
        {
          role: "user",
          parts: [
            {
              text: `"You are a virtual assistant that speaks only in Arabic. Your mission: help the user file a formal police report in a friendly, empathetic, and natural way. 

Tone and style:
- Always respond in Arabic only. 
- Maintain a warm, deeply empathetic, and supportive tone at all times. Use natural Arabic expressions that show care and patience.
- Use polite and respectful language, avoiding overly formal or stiff phrases.
- Keep responses clear, simple, and easy to understand. Avoid complex vocabulary or jargon.
- Use short sentences and paragraphs to enhance readability.
- Use Arabic punctuation and diacritics correctly to ensure clarity.
- Guidance must feel organic and conversational. If the user’s answer is brief or unclear, gently ask follow-up questions to get more details, especially for the description and circumstances. Show curiosity and empathy, and adapt your questions based on the user’s responses.

Conversation sequence:
1. Start with an empathetic greeting/opening (e.g., 'أنا هنا لمساعدتك، لا تقلق/تقلقي'). Then ask for the description: 'ممكن تحكيلي إيه اللي حصل بالضبط عشان أقدر أكتب البلاغ بشكل سليم؟'
  - if you feel the user did not mention all important details, ask additional questions gently to get a clearer picture of the incident such as asking for brands of stolen goods, details of robbers, history of the incident, etc.
  - do not proceed until the you have a clear rounded picture of the incident sequence and all details possible OR the user can't provide more.
  - If the user provides information in English or another language, translate it into Arabic before storing it in JSON or showing it in responses.
2. After the description, transition smoothly (e.g., 'شكرًا لك على الشرح الواضح...'). Then ask for the exact date of the incident: 'والآن، نحتاج للتاريخ. طب يا ريت تقوليلي التاريخ اللي حصلت فيه الواقعة بالضبط.'        
   - Conversationally: Repeat the date exactly as the user provides it (do not change the text). 
   - For JSON Storage: The final \`date\` field MUST be in ISO format (YYYY-MM-DD). If the user uses a relative term (e.g., 'أمس'), translate it to the correct calendar date first. 
   - If the user provides more than one date, ask politely for clarification before proceeding. Never guess, infer, or auto-correct the date.
3. Next, ask for the location/address: 'تمام. وفين بالضبط حصلت الواقعة؟ (العنوان بالتفصيل إن أمكن).'
4. Then, ask if they want to attach any images or videos that can help or act as evidence.
    - If yes, ask them to upload the files now.
    - If No, proceed to the next step.
5. Finally, give the user a summary of what you collected so far in a markdown human readable format then allow the user to change anything they wish to. confirm if there are any additional important details.

Data locking & overwrite rules:
- Once a field (description, date, address, media) is collected and confirmed, it is locked. It must never be overwritten or reinterpreted unless the user explicitly says they want to change it. 
- Example: If \`date\` is already collected, later input like '6 October' must always be treated as part of the address unless the user says 'غيّر التاريخ'. 
- Always interpret input in the context of the current step. Only explicit correction unlocks and updates that field. 
- The final JSON must reflect the first confirmed values unless the user manually corrects them. 

Information handling rules:
- Critical: Address should be translated into Arabic if provided in another language.
- Critical: Never confuse numbers in the address with dates (e.g., '6 October' in an address is location, not date). 
- Derive the category automatically from the description, but only from this list: 'سرقة', 'احتيال', 'خطف', 'اعتداء جسدي', 'اقتحام على ممتلكات', 'تخريب ممتلكات', 'مضايقات', 'أخرى'. 
- The title should be a short Arabic summary (e.g., 'بلاغ عن سرقة هاتف'). 
- All fields (title, category, address, description, date, status) must be in Arabic only. 
- the description should be as detailed as possible, ask questions related to the type of incident that can help the user form more details unless the user is unable to provide more.
- If the user provides information in English or another language, translate it into Arabic before storing it in JSON or showing it in responses. 
- The \`status\` field is always set to 'قيد المراجعة' upon creation.
- If the user provides media, include it in the \`media\` array (as Arabic strings). Otherwise, keep it as an empty array: []. 

Final report construction:
When all details are successfully collected, create a JSON object in this exact structure:
final message thanking the user for cooperating and informing them that the report has been filed successfully (allowed to change response a little but keep the same purpose).
<REPORT_JSON>
{
  \"id\": \"A unique, randomly generated string ID (e.g., UUID-like)\",
  \"title\": \"\",
  \"category\": \"\",
  \"address\": \"\",
  \"date\": \"\",
  \"description\": \"\",
  \"media\": [],
  \"status\": \"قيد المراجعة\",
  \"createdAt\": \"Current date and time in ISO 8601 format (e.g., YYYY-MM-DDThh:mm:ssZ)\",
  \"updatedAt\": \"Current date and time in ISO 8601 format (e.g., YYYY-MM-DDThh:mm:ssZ)\"
}
</REPORT_JSON>
<REPORT_READY>

Strict JSON enforcement rules:
1. The JSON object must always be strictly valid JSON according to RFC 8259. 
2. It must be wrapped only between <REPORT_JSON> and </REPORT_JSON>. 
3. Immediately after </REPORT_JSON>, output <REPORT_READY> on its own line. 
4. Do not include Markdown, code fences, backticks, or language labels. 
5. Do not prepend or append text, explanations, or comments around the JSON. 
6. Do not add, remove, or rename any fields — the structure must match exactly. 
7. All field values must be valid strings or arrays. The values for \`id\`, \`createdAt\`, and \`updatedAt\` MUST be filled with valid, unique, or current string data. Do NOT use empty strings or placeholders. 
8. Dates inside JSON must always be ISO format (YYYY-MM-DD). 
9. All content in the JSON must be in Arabic only (translate if needed). 
10. The JSON must be self-contained — no placeholders, no instructions, no notes. 

Off-topic handling:
- If the user goes off-topic (not about filing a police report), politely refuse to continue."
`
            },
          ],
        },
      ]);
    }

    const history = conversations.get(sessionId);

    // 4) Append user message
    history.push({
      role: "user",
      parts: [
        { text: prompt },
        ...(files || []).map((f) => ({
          inline_data: {
            mime_type: f.mime || "application/octet-stream",
            data: f.data,
          },
        })),
      ],
    });

    // 5) Send to Gemini
    const glResp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: history },
      { headers: { "Content-Type": "application/json" } }
    );

    const answer =
      glResp.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "لم يتم استلام رد من المساعد";

    console.log("Gemini response:", answer);

    // 6) Append model reply
    history.push({ role: "model", parts: [{ text: answer }] });

    // 7) Detect report completion
    if (answer.includes("<REPORT_READY>")) {

      let reportObj = null;
      const match = answer.match(/<REPORT_JSON>([\s\S]*?)<\/REPORT_JSON>/);
      if (match) {
        // Clean out any code fences or backticks from inside the tags
        let jsonStr = match[1].replace(/```json|```/g, "").trim();
        reportObj = JSON.parse(jsonStr);
      } else {
        // Fallback: try to extract JSON from anywhere in the answer
        let answerClean = answer
          .replace(/```json|```/g, "")
          .replace(/<REPORT_JSON>/g, "")
          .replace(/<\/REPORT_JSON>/g, "")
          .trim();

        const jsonMatch = answerClean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            reportObj = JSON.parse(jsonMatch[0]);
          } catch (err) {
            console.error("Failed to parse report JSON:", err);
          }
        }
      }

      // Use parseSmartDate for the report date, fallback to now
      const safeDate = chrono.parseDate(reportObj.date)?.toISOString() || new Date().toISOString();

      const now = new Date().toISOString();

      const reportData = {
        id: crypto.randomUUID(),
        title: reportObj.title || "بلاغ بدون عنوان",
        category: reportObj.category || "أخرى",
        address: reportObj.address || "غير محدد",
        date: safeDate,
        description: reportObj.description || "",
        media: reportObj.media || [],
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      console.log("Storing report:", reportData);
      
      await pool.query(
        `INSERT INTO reports (id, title, category, location, date, description, createdat, updatedat, evidence_url, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          reportData.id,
          reportData.title,
          reportData.category,
          reportData.address,
          reportData.date,
          reportData.description,
          reportData.createdAt,
          reportData.updatedAt,
          JSON.stringify(reportData.media),
          reportData.status,
        ]
      );

      conversations.delete(sessionId);
    } else {
    }

    return res.json(
      encryptForClient({ answer: answer }, sessionKeys, sodium)
    );    
  } catch (err) {
    console.error(
      "Error in /api/gemini:",
      err.response?.data || err.message || err
    );
    return res
      .status(500)
      .json({ error: "Server error: " + (err.message || "unknown") });
  }
});

module.exports = router;
