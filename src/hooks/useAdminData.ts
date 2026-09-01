import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchAdminData();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchAdminData()
      .then((next) => { if (active) setData(next); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load admin data"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { ...data, loading, error, refresh };
}
