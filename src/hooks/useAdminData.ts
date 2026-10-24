import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAdminData, type AdminData } from "../lib/api/admin";

const EMPTY: AdminData = {
  overview: {
    landlordCount: 0,
    activeLandlords: 0,
    suspendedLandlords: 0,
    studentCount: 0,
    bedCount: 0,
    occupiedBeds: 0,
    occupancyRate: 0,
    collectedRevenue: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
  },
  landlords: [],
  students: [],
  activity: [],
};

export function useAdminData() {
  const [data, setData] = useState<AdminData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminData();
      if (mounted.current && currentRequestId === requestId.current) setData(next);
    } catch (err) {
      if (mounted.current && currentRequestId === requestId.current) {
        setError(err instanceof Error ? err.message : "Could not load admin data");
      }
    } finally {
      if (mounted.current && currentRequestId === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
