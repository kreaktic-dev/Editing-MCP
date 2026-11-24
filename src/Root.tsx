import React from "react";
import { Composition } from "remotion";
import { BridgeShort as PisaShort, BRIDGE_FRAMES as PISA_FRAMES } from "./videos/pisa/Bridge";

export const Root: React.FC = () => (
  <Composition id="PisaShort" component={PisaShort} durationInFrames={PISA_FRAMES} fps={30} width={1080} height={1920} />
);
