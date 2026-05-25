package com.springboot.MyTodoList.config;

import oracle.ucp.jdbc.PoolDataSource;
import oracle.ucp.jdbc.PoolDataSourceFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.sql.SQLException;

@Configuration
@Profile("!test")
public class OracleConfiguration {
    private static final Logger logger = LoggerFactory.getLogger(OracleConfiguration.class);

    @Autowired
    private DbSettings dbSettings;

    @Autowired
    private Environment env;

    @Bean
    public DataSource dataSource() throws SQLException {
        PoolDataSource pds = PoolDataSourceFactory.getPoolDataSource();
        pds.setConnectionFactoryClassName("oracle.jdbc.pool.OracleDataSource");
        pds.setURL(dbSettings.getUrl());
        pds.setUser(dbSettings.getUsername());
        pds.setPassword(dbSettings.getPassword());

        int initialPool = env.getProperty("spring.datasource.oracleucp.initial-pool-size", Integer.class, 2);
        int minPool = env.getProperty("spring.datasource.oracleucp.min-pool-size", Integer.class, 2);
        int maxPool = env.getProperty("spring.datasource.oracleucp.max-pool-size", Integer.class, 10);
        pds.setInitialPoolSize(initialPool);
        pds.setMinPoolSize(minPool);
        pds.setMaxPoolSize(maxPool);
        pds.setConnectionPoolName(
            env.getProperty("spring.datasource.oracleucp.connection-pool-name", "mtdrConnectionPool"));
        pds.setValidateConnectionOnBorrow(true);
        pds.setSQLForValidateConnection(
            env.getProperty("spring.datasource.oracleucp.sql-for-validate-connection", "select 1 from dual"));

        logger.info("Using Oracle UCP pool url={} min={} max={}", dbSettings.getUrl(), minPool, maxPool);
        return pds;
    }
}
