import anayaLogo from "../assets/anaya-logo.png";

export const companyBrand = {
  name: "Anaya Coffee",
  legalName: "Asociacion Huila Coffee Farmers",
  nit: "901847571",
  address: "Carrera 5E # 10-16, Pitalito, Huila - Colombia",
  phone: "+57 320 6083481",
  email: "fincaanaya@gmail.com",
  instagram: "@fincaanaya",
  logo: anayaLogo,
};

export const getPrintableLogo = () => {
  return new URL(companyBrand.logo, window.location.origin).href;
};
