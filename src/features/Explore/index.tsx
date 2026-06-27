'use client';

import { memo } from 'react';

import AppScenarios from './components/AppScenarios';
import CoreProducts from './components/CoreProducts';
import CTABanner from './components/CTABanner';
import CustomService from './components/CustomService';
import ExploreFooter from './components/ExploreFooter';
import Header from './components/Header';
import Hero from './components/Hero';
import { styles } from './style';

const Explore = memo(() => {
  return (
    <div className={styles.container}>
      <Header />
      <Hero />
      <CoreProducts />
      <AppScenarios />
      <CustomService />
      <CTABanner />
      <ExploreFooter />
    </div>
  );
});

Explore.displayName = 'Explore';
export default Explore;
