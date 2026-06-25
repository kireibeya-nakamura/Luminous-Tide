export type EffortLog = {
  id: number;
  label: string;
  minutes: number;
  createdAt: Date;
};

export type ParticleBurst = {
  id: number;
  level: number;
  amount: number;
};

export type OceanTone = "surface" | "depth";
