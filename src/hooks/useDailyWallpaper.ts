// Daily rotating wallpaper hook for historic Angolan landmarks
import day1 from '@/assets/wallpapers/day-1-fortaleza-sao-miguel.jpg';
import day2 from '@/assets/wallpapers/day-2-cristo-rei.jpg';
import day3 from '@/assets/wallpapers/day-3-serra-da-leba.jpg';
import day4 from '@/assets/wallpapers/day-4-kalandula-falls.jpg';
import day5 from '@/assets/wallpapers/day-5-igreja-remedios.jpg';
import day6 from '@/assets/wallpapers/day-6-miradouro-lua.jpg';
import day7 from '@/assets/wallpapers/day-7-cidade-alta.jpg';

export interface WallpaperInfo {
  image: string;
  name: string;
  location: string;
  description: string;
}

const wallpapers: WallpaperInfo[] = [
  {
    image: day1,
    name: 'Fortaleza de São Miguel',
    location: 'Luanda',
    description: 'Fortaleza histórica do século XVI com vista para a baía de Luanda',
  },
  {
    image: day2,
    name: 'Cristo Rei',
    location: 'Lubango',
    description: 'Majestosa estátua do Cristo Rei no topo da montanha',
  },
  {
    image: day3,
    name: 'Serra da Leba',
    location: 'Lubango',
    description: 'Famosa estrada serpenteante atravessando as montanhas',
  },
  {
    image: day4,
    name: 'Quedas de Kalandula',
    location: 'Malanje',
    description: 'Uma das maiores cascatas de África',
  },
  {
    image: day5,
    name: 'Igreja N. Sra. dos Remédios',
    location: 'Luanda',
    description: 'Igreja barroca colonial portuguesa histórica',
  },
  {
    image: day6,
    name: 'Miradouro da Lua',
    location: 'Luanda',
    description: 'Paisagem lunar única com formações rochosas dramáticas',
  },
  {
    image: day7,
    name: 'Cidade Alta',
    location: 'Luanda',
    description: 'Centro histórico colonial com vista para a baía',
  },
];

export function useDailyWallpaper(): WallpaperInfo {
  // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = new Date().getDay();
  
  // Map to wallpaper index (Sunday = 0 maps to wallpaper 0, etc.)
  // This ensures the wallpaper changes every day
  const wallpaperIndex = dayOfWeek % wallpapers.length;
  
  return wallpapers[wallpaperIndex];
}

export function getAllWallpapers(): WallpaperInfo[] {
  return wallpapers;
}
