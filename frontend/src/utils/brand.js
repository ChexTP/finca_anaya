export const companyBrand = {
  name: "Anaya Coffee",
  legalName: "Asociacion Huila Coffee Farmers",
  nit: "901847571",
  address: "Carrera 5E # 10-16, Pitalito, Huila - Colombia",
  phone: "+57 320 6083481",
  email: "fincaanaya@gmail.com",
  instagram: "@fincaanaya",
  logo: "/logos/anaya-logo-mark.png",
  printableLogo: "/logos/anaya-logo-full.png",
};

export const getPrintableLogo = () => {
  return `${window.location.origin}${companyBrand.printableLogo}`;
};
