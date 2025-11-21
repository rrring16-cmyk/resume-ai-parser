export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const downloadCSV = (content: string, fileName: string) => {
  const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateCSVContent = (resumes: any[]): string => {
  const headers = ["上傳日期", "姓名", "性別", "出生日期", "手機1", "工作經驗", "特殊身份", "工作經驗一公司名稱", "工作經驗一職務名稱", "戶籍縣市", "檔案連結"];
  const rows = resumes.map((r: any) => {
    if (!r.data) return [];
    return [
      r.uploadDate,
      r.data.name || "",
      r.data.gender || "",
      r.data.dob || "",
      r.data.mobile || "",
      r.data.workExperienceYears || "",
      r.data.specialIdentity || "",
      r.data.lastCompanyName || "",
      r.data.lastJobTitle || "",
      r.data.householdCity || "",
      r.fileLink || ""
    ].map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`);
  });
  return [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
};