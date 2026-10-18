import { GoogleGenAI } from '@google/genai';

/**
 * High-Speed Vercel Serverless & Express Route Handler
 * Optimized for low-latency with maxOutputTokens: 2048 and lightweight Canvas payload
 * Endpoint: POST /api/extract
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed. Only POST is supported.`,
    });
  }

  try {
    const { base64Data, mimeType, filename } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Missing base64Data in request body.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured in the server environment.',
      });
    }

    // Strip data URL prefix
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
    const resolvedMimeType = mimeType || 'image/jpeg';

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const extractionPrompt =
      'You are a high-speed data entry assistant. Extract all tabular data from this document. ' +
      'Be sure to extract Product_Name (or Item), Quantity, Expiry_Date (as formatted or YYYY-MM-DD), Amount (or Price), Batch_No, and other inferred fields. ' +
      'Return ONLY a strict JSON array of objects. Keys must be dynamically inferred. Do NOT return markdown formatting like ```json. ONLY return valid JSON.';

    const parts = [];
    if (resolvedMimeType === 'image/svg+xml') {
      const svgText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      parts.push({
        text: `Here is the document content (SVG):\n\n${svgText}`,
      });
    } else {
      let geminiMime = resolvedMimeType;
      if (geminiMime === 'image/jpg') geminiMime = 'image/jpeg';
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: geminiMime,
        },
      });
    }

    parts.push({
      text: extractionPrompt,
    });

    const generationConfig = {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 2048, // Limit response token size for maximum speed
    };

    // Execute using Gemini Flash model with maxOutputTokens: 2048 for high speed
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: generationConfig,
    });

    const responseText = response.text || '';
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    let parsedData;
    try {
      parsedData = JSON.parse(cleanedText);
    } catch {
      const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsedData = JSON.parse(arrayMatch[0]);
      } else {
        const objMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          parsedData = JSON.parse(objMatch[0]);
        } else {
          throw new Error('Model did not return valid JSON.');
        }
      }
    }

    let tableRows = [];
    if (Array.isArray(parsedData)) {
      tableRows = parsedData;
    } else if (typeof parsedData === 'object' && parsedData !== null) {
      const arrayKey = Object.keys(parsedData).find((k) => Array.isArray(parsedData[k]));
      if (arrayKey && Array.isArray(parsedData[arrayKey])) {
        tableRows = parsedData[arrayKey];
      } else {
        tableRows = [parsedData];
      }
    }

    tableRows = tableRows.filter((item) => item && typeof item === 'object' && !Array.isArray(item));

    if (tableRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        columns: [],
        message: 'No tabular data rows detected in the provided document.',
        meta: {
          filename: filename || 'document',
          rowCount: 0,
          extractedAt: new Date().toISOString(),
        },
      });
    }

    const columnSet = new Set();
    tableRows.forEach((row) => {
      Object.keys(row).forEach((k) => columnSet.add(k));
    });
    const columns = Array.from(columnSet);

    const normalizedRows = tableRows.map((row, idx) => {
      const normalizedRow = { _id: `row-${idx + 1}-${Date.now()}` };
      columns.forEach((col) => {
        normalizedRow[col] = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
      });
      return normalizedRow;
    });

    return res.status(200).json({
      success: true,
      data: normalizedRows,
      columns,
      meta: {
        filename: filename || 'document',
        rowCount: normalizedRows.length,
        columnCount: columns.length,
        extractedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in /api/extract:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract document data via Gemini Flash.',
    });
  }
}
