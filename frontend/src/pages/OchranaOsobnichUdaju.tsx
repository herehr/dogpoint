import React from "react";
import { Container, Typography, Box, Link } from "@mui/material";

const OchranaOsobnichUdaju: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h3" gutterBottom sx={{ fontWeight: "bold", color: "#26E6EA" }}>
        Ochrana osobních údajů
      </Typography>

      <Typography variant="body1" paragraph>
        Společnost <strong>Dogpoint z.s.</strong>, IČO 22875220, se sídlem v České republice
        (dále jen „Správce“), zpracovává osobní údaje v souladu s Nařízením Evropského parlamentu
        a Rady (EU) 2016/679 (GDPR).
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        1. Jaké údaje zpracováváme
      </Typography>
      <Typography variant="body1" paragraph>
        Zpracováváme pouze údaje, které nám poskytnete dobrovolně v rámci adopce, daru nebo
        registrace: jméno, příjmení, e-mail, telefon, poštovní adresu, a údaje o platbě.
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        2. Účel zpracování
      </Typography>
      <Typography variant="body1" paragraph>
        Údaje zpracováváme pro účely evidence dárců, zasílání potvrzení o daru, informací o
        adoptovaných psech a pro účetní a daňové povinnosti.
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        3. Uchovávání a zabezpečení dat
      </Typography>
      <Typography variant="body1" paragraph>
        Všechna data jsou bezpečně uložena v datových centrech společnosti{" "}
        <strong>DigitalOcean</strong> v rámci <strong>Evropské unie (region FRA1, Frankfurt)</strong>.
        Přístup k údajům mají pouze oprávnění zaměstnanci a smluvní partneři Správce, kteří jsou
        vázáni mlčenlivostí.
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        4. Sdílení údajů
      </Typography>
      <Typography variant="body1" paragraph>
        Osobní údaje nepředáváme třetím stranám mimo EU. V případě plateb jsou údaje zpracovávány
        pouze prostřednictvím důvěryhodných partnerů (např. Stripe, PayPal) v souladu s jejich
        vlastními zásadami ochrany osobních údajů.
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        5. Vaše práva
      </Typography>
      <Typography variant="body1" paragraph>
        Máte právo na přístup k údajům, opravu, výmaz, omezení zpracování, přenositelnost a právo
        vznést námitku proti zpracování. V případě pochybností se můžete obrátit na nás nebo na
        <Link href="https://www.uoou.cz/" target="_blank" rel="noopener">
          {" "}Úřad pro ochranu osobních údajů.
        </Link>
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        6. Doba uchování
      </Typography>
      <Typography variant="body1" paragraph>
        Údaje uchováváme po dobu nezbytnou k plnění zákonných povinností a po dobu trvání adopce
        nebo darovacího vztahu, nejdéle však 10 let.
      </Typography>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        7. Kontaktní údaje správce
      </Typography>
      <Typography variant="body1" paragraph>
        Dogpoint z.s.  
        <br />
        Email: <Link href="mailto:info@dog-point.cz">info@dog-point.cz</Link>  
        <br />
        Web: <Link href="https://dog-point.cz" target="_blank" rel="noopener">www.dog-point.cz</Link>
      </Typography>

      <Box sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          Poslední aktualizace: říjen 2025
        </Typography>
      </Box>
    </Container>
  );
};

export default OchranaOsobnichUdaju;