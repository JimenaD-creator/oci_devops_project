-- Probe Oracle AI Vector Search support (run as MANAGER on 23ai+).
-- Success: CREATE + DROP succeed. Failure on 19c: ORA-00907 / ORA-00902.

SELECT banner FROM v$version WHERE ROWNUM = 1;

SELECT name, value FROM v$parameter WHERE name = 'compatible';

CREATE TABLE MANAGER.VECTOR_SUPPORT_PROBE (
    id NUMBER PRIMARY KEY,
    probe_vec VECTOR
);

DROP TABLE MANAGER.VECTOR_SUPPORT_PROBE;
