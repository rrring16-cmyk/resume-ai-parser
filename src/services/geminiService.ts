import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ResumeData } from "../types";

const resumeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "申請人全名 (Name)" },
    gender: { type: Type.STRING, description: "性別 (Gender: 男/女/其他)" },
    dob: { type: Type.STRING, description: "出生日期 (YYYY-MM-DD 格式)" },
    mobile: { type: Type.STRING, description: "手機號碼 (Mobile Number)" },
    workExperienceYears: { type: Type.STRING, description: "總工作經驗年資 (例如：'5年', '無')" },
    specialIdentity: { type: Type.STRING, description: "特殊身份 (例如：學生, 原住民, 身心障礙, 退伍軍人, 或 '無')" },
    lastCompanyName: { type: Type.STRING, description: "最近一份工作的公司名稱 (Most Recent Company)" },
    lastJobTitle: { type: Type.STRING, description: "最近一份工作的職務名稱 (Most Recent Job Title)" },
    householdCity: { type: Type.STRING, description: "戶籍地址的縣市 (例如：台北市, 台中市)" },
  },
  required: ["name"],
};

export const extractResumeData = async (base64Data: string, mimeType: string): Promise<ResumeData> => {
  if (!process.env.API_KEY) {
    throw new Error("Missing API_KEY");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: "請分析這份履歷，並提取以下欄位資料。請務必使用「繁體中文」回傳。若欄位找不到，請回傳空字串。\n\n需要提取的欄位包含：\n1. 姓名\n2. 性別\n3. 出生日期\n4. 手機1 (手機號碼)\n5. 工作經驗 (總年資)\n6. 特殊身份 (如：原住民、身心障礙、學生...等，若無則填'無')\n7. 工作經驗一公司名稱 (最近一家公司)\n8. 工作經驗一職務名稱 (最近一份職稱)\n9. 戶籍地址 (請只提取「縣市」名稱，例如：台北市、新北市、高雄市，不要完整地址)" }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: resumeSchema,
        temperature: 0.1,
      }
    });
    const text = response.text;
    if (!text) throw new Error("No response text generated.");
    return JSON.parse(text) as ResumeData;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};