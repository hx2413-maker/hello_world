export type ProfileFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: {
    firstName?: string;
    lastName?: string;
    photo?: string;
  };
};
