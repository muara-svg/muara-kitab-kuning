import React from 'react';
import MenuLoginAkun from './MenuLoginAkun';
import MenuMembership from './MenuMembership';
import MenuNotifikasi from './MenuNotifikasi';
import MenuSedekah from './MenuSedekah';
import { UserProfile, NotificationItem, SedekahCampaign } from '../types';

interface MenuUtamaProps {
  userProfile: UserProfile;
  notifications: NotificationItem[];
  sedekahCampaigns: SedekahCampaign[];
  onLogin: (name: string, email: string, phone: string) => void;
  onLogout: () => void;
  onBuyMembership: (planName: string) => void;
  onDonate: (campaignId: string, amount: number) => void;
  onLoginClick?: () => void;
}

export default function MenuUtama({
  userProfile,
  notifications,
  sedekahCampaigns,
  onLogin,
  onLogout,
  onBuyMembership,
  onDonate,
  onLoginClick,
}: MenuUtamaProps) {
  return (
    <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white">
      {/* 4-Column Feature Grid Menu with stylish iconography on all devices */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-4 mb-3 sm:mb-4">
        
        {/* MENU 1: AKUN */}
        <MenuLoginAkun 
          userProfile={userProfile}
          onLogin={onLogin}
          onLogout={onLogout}
          onLoginClick={onLoginClick}
        />

        {/* MENU 2: MEMBERSHIP */}
        <MenuMembership 
          userProfile={userProfile}
          onBuyMembership={onBuyMembership}
          onLoginClick={onLoginClick}
        />

        {/* MENU 3: NOTIFIKASI */}
        <MenuNotifikasi 
          notifications={notifications}
        />

        {/* MENU 4: SEDEKAH AMAL */}
        <MenuSedekah 
          sedekahCampaigns={sedekahCampaigns}
          onDonate={onDonate}
        />

      </div>
    </div>
  );
}
