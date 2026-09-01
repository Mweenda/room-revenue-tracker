import { useEffect, useState } from "react";
import { readStudentViewportSize, studentViewportFromSize, type StudentViewport } from "../lib/studentViewport";

export function useStudentViewport(): StudentViewport {
  const [viewport, setViewport] = useState<StudentViewport>(() => {
    const size = readStudentViewportSize();
    return studentViewportFromSize(size.width, size.height);
  });

  useEffect(() => {
    const update = () => {
      const size = readStudentViewportSize();
      setViewport(studentViewportFromSize(size.width, size.height));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return viewport;
}
