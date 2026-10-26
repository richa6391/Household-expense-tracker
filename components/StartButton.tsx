"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasData } from "@/lib/storage";

export default function StartButton() {
  const [existing, setExisting] = useState(false);
  useEffect(() => setExisting(hasData()), []);
  return (
    <Link href="/app" className="btn btn-primary">
      {existing ? "Open my helpers" : "Start"}
    </Link>
  );
}
