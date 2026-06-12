package com.springboot.MyTodoList.service;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

/** Evicts server-side dashboard bundle cache after task/sprint mutations. */
@Service
public class ProjectBundleCacheEvictor {

    @CacheEvict(value = "projects", key = "'dashboard-bundle:' + #projectId")
    public void evictDashboardBundle(Long projectId) {
        /* Cache eviction handled by Spring AOP. */
    }
}
