import { useCallback, useMemo, useRef, useState } from "react";

import { UseApiCRUDControllerConfigType } from "./types";

// Every controller needs the same "flip the flag around an awaited operation" behaviour, so it is
// written once here instead of once per controller.
//
// The in-flight count, rather than a boolean, is what makes it correct under concurrency: two
// overlapping reads would otherwise have the first one to settle clear the spinner while the
// second is still running.
export const useLoadingState = ({
  initialLoading = false
}: UseApiCRUDControllerConfigType = {}) => {
  const [isLoading, setIsLoading] = useState<boolean>(initialLoading);
  const inFlightCountRef = useRef<number>(0);

  //-----------

  const withLoading = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    inFlightCountRef.current += 1;
    setIsLoading(true);
    try {
      return await operation();
    } finally {
      inFlightCountRef.current -= 1;
      if (inFlightCountRef.current === 0) setIsLoading(false);
    }
  }, []);

  //-----------

  return useMemo(() => ({ isLoading, withLoading }), [isLoading, withLoading]);
};
