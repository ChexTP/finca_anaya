import { useEffect, useState } from "react";
import { paginateItems } from "../utils/listSearch";

export const usePagination = (items, resetKey = "", pageSize = 8) => {
  const [position, setPosition] = useState({ key: resetKey, page: 1 });
  const pagination = paginateItems(items, position.key === resetKey ? position.page : 1, pageSize);
  useEffect(() => {
    setPosition((current) => current.key === resetKey && current.page === pagination.page
      ? current : { key: resetKey, page: pagination.page });
  }, [resetKey, pagination.page]);
  return { ...pagination, setPage: (page) => setPosition({ key: resetKey, page }) };
};
