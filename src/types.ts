export interface ParsedResume {
  id: string;
  fileName: string;
  uploadDate: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  data?: ResumeData;
  fileLink?: string; 
}

export interface ResumeData {
  name: string;
  gender: string;
  dob: string;
  mobile: string;
  workExperienceYears: string;
  specialIdentity: string;
  lastCompanyName: string;
  lastJobTitle: string;
  householdCity: string;
}