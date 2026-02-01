"use client";

import { Suspense } from "react";
import { HDSIPageContent } from "./HDSIPageContent";

export default function HDSIPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading HDSI Editor...</div>}>
      <HDSIPageContent />
    </Suspense>
  );
}
