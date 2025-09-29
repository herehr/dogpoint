// frontend/src/pages/LandingPage.tsx
import React from 'react';
import { Box } from '@mui/material';
import Hero from '../sections/Hero';
import HowItWorks from '../sections/HowItWorks';
import AnimalTeasers from '../sections/AnimalTeasers';
import AboutUs from '../sections/AboutUs';
import SiteFooter from '../sections/SiteFooter';

export default function LandingPage() {
  return (
    <Box>
      <Hero />
      <HowItWorks />
      <AnimalTeasers />
      <AboutUs />
      <SiteFooter />
    </Box>
  );
}