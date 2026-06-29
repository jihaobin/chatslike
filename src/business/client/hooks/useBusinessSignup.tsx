export interface BusinessSignupFomData {}

// eslint-disable-next-line unused-imports/no-unused-vars
export const useBusinessSignup = (form: any) => {
  return {
    businessElement: null,
    // eslint-disable-next-line unused-imports/no-unused-vars
    getCaptchaTokenOnError: async (error: unknown) => undefined as string | null | undefined,
    getFetchOptions: async () => {
      return {};
    },
    // eslint-disable-next-line unused-imports/no-unused-vars
    preSocialSignupCheck: async (values: BusinessSignupFomData) => {
      return true;
    },
  };
};
