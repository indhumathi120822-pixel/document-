import { GoogleGenAI } from '@google/genai';

/**
 * Serverless / Express Handler for Auto-Categorization
 * POST /api/categorize
 * Body: { rows: Array<Record<string, unknown>>, columns: string[] }
 */
export default async function categorizeHandler(req, res) {
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
    const { rows, columns } = req.body || {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty rows array in request body.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const categorizePrompt = `You are an expert data classification assistant.
Analyze each row in the following dataset and assign a standardized, concise "Category" field to each item.
Common categories include (but are not limited to):
- Food & Dining
- Travel & Transportation
- Medical & Healthcare
- Office Supply & Hardware
- Cloud & IT Infrastructure
- Professional Services & Legal
- Utilities & Facilities
- Software & Subscriptions
- Marketing & Advertising

Dataset to categorize:
${JSON.stringify(rows.map((r) => {
  // strip internal id for cleaner prompt
  const copy = { ...r };
  delete copy._id;
  return copy;
}))}

Return ONLY a strict JSON array of objects.
Each object MUST be the original row with an added "Category" string key.
Do NOT return markdown fences like \`\`\`json. Return ONLY valid JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          text: categorizePrompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text || '';
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    let categorizedData;
    try {
      categorizedData = JSON.parse(cleanedText);
    } catch {
      const match = cleanedText.match(/\[[\s\S]*\]/);
      if (match) {
        categorizedData = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse Gemini categorization response.');
      }
    }

    if (!Array.isArray(categorizedData)) {
      if (typeof categorizedData === 'object' && categorizedData !== null) {
        const key = Object.keys(categorizedData).find((k) => Array.isArray(categorizedData[k]));
        categorizedData = key ? categorizedData[key] : [categorizedData];
      } else {
        categorizedData = rows;
      }
    }

    // Merge categories back into original rows preserving original _id
    const updatedRows = rows.map((originalRow, idx) => {
      const aiItem = categorizedData[idx] || {};
      const inferredCategory = aiItem.Category || aiItem.category || 'General Operations';
      return {
        ...originalRow,
        Category: inferredCategory,
      };
    });

    // Ensure 'Category' is in columns list
    const updatedColumns = Array.from(new Set([...(columns || []), 'Category']));

    return res.status(200).json({
      success: true,
      data: updatedRows,
      columns: updatedColumns,
      message: `Successfully categorized ${updatedRows.length} rows.`,
    });
  } catch (err) {
    console.error('Error in /api/categorize:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Auto-categorization failed.',
    });
  }
}
