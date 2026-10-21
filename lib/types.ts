export type Threat = { id: string; type: string; title: string; region: string; district?: string; locality?: string; lat: number; lon: number; heading?: number | null; confidenceLevel: string; displayConfidence?: string; sourceCount: number; updatedAt: string; status: string; explanationShort: string; areaOnly?: boolean; advisory?: boolean; destination?: boolean; presumptiveCourse?: boolean; positionQuality?: string; uncertaintyKm?: number; count?: number; trail?: {lat:number;lon:number;t:string}[] };
export type Alert = { key: string; name: string; oblast: string; since?: string; level: 'red'|'yellow'; reasons?: string[] };
export type Alerts = { raions: Alert[]; oblasts: Alert[] };
export type Message = { channel: string; text: string; date: string };
export type GeoFeature = { properties: {key:string; region?:string;name?:string;rayon?:string}; geometry: {type:string;coordinates:any[]}; path:string };
export type Settlement = { id:string; name:string; lon:number; lat:number; type:'city'|'town' };
export type LiveData = { threats: Threat[]; alerts: Alerts; messages: Message[]; receivedAt: string; provider: string; providers: { alertsInUa: boolean; ukraineAlarm: boolean }; errors: string[] };
